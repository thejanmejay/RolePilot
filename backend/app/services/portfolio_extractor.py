"""Service for safe portfolio and personal website extraction with strict SSRF protections."""

from __future__ import annotations

import ipaddress
import logging
import re
import socket
import urllib.parse
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional, Set
import httpx

logger = logging.getLogger(__name__)

MAX_PAGE_SIZE = 2 * 1024 * 1024  # 2 MB limit
REQUEST_TIMEOUT_SECONDS = 8.0
MAX_REDIRECTS = 3

DISALLOWED_SCHEMES = {"file", "ftp", "gopher", "data", "javascript", "blob", "mailto"}


def is_private_or_restricted_ip(ip_str: str) -> bool:
    """Check if an IP string belongs to private, loopback, link-local, multicast, or reserved ranges."""
    try:
        ip = ipaddress.ip_address(ip_str)
        # Check standard properties
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return True

        # Check IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:169.254.169.254)
        if hasattr(ip, "ipv4_mapped") and ip.ipv4_mapped:
            return is_private_or_restricted_ip(str(ip.ipv4_mapped))

        # Check 6to4 prefix (2002::/16) which embeds IPv4 addresses
        if isinstance(ip, ipaddress.IPv6Address) and ip.exploded.startswith("2002:"):
            # Extract embedded 32-bit IPv4 from bits 16..47
            v4_bytes = ip.packed[2:6]
            v4_ip = ipaddress.IPv4Address(v4_bytes)
            return is_private_or_restricted_ip(str(v4_ip))

        return False
    except ValueError:
        return True


def validate_safe_url(raw_url: str) -> str:
    """Validate a user-provided URL against SSRF vulnerabilities, illegal schemes, and private networks.
    
    Raises ValueError with descriptive reason if URL is disallowed.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("URL must be a non-empty string.")

    cleaned = raw_url.strip()
    parsed_initial = urllib.parse.urlparse(cleaned)
    if parsed_initial.scheme:
        if parsed_initial.scheme.lower() not in {"http", "https"}:
            raise ValueError(f"Unsupported URL scheme '{parsed_initial.scheme}'. Only HTTP and HTTPS are permitted.")
    else:
        cleaned = "https://" + cleaned

    parsed = urllib.parse.urlparse(cleaned)

    # 1. Validate scheme
    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError(f"Unsupported URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted.")

    # 2. Validate hostname presence
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: Hostname is missing.")

    hostname_lower = hostname.lower()

    # Reject localhost & common loopback aliases
    if hostname_lower in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}:
        raise ValueError("Access to localhost or loopback addresses is strictly forbidden.")

    # Reject embedded userinfo (e.g. http://user:pass@host)
    if parsed.username or parsed.password:
        raise ValueError("URLs containing embedded authentication credentials are not permitted.")

    # 3. DNS Resolution check to prevent SSRF against internal/cloud metadata networks
    try:
        addr_infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for family, _, _, _, sockaddr in addr_infos:
            ip_str = sockaddr[0]
            if is_private_or_restricted_ip(ip_str):
                raise ValueError(
                    f"Access to private, loopback, or cloud-internal network destination ({ip_str}) is prohibited."
                )
    except socket.gaierror as exc:
        raise ValueError(f"Unable to resolve hostname '{hostname}': {exc}")

    return cleaned


class SafeHTMLTextExtractor(HTMLParser):
    """Zero-dependency, memory-safe HTML parser that strips scripts/styles and extracts text & metadata."""

    def __init__(self) -> None:
        super().__init__()
        self.in_script = False
        self.in_style = False
        self.in_title = False
        self.title_parts: List[str] = []
        self.meta_tags: Dict[str, str] = {}
        self.text_chunks: List[str] = []
        self.links: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, Optional[str]]]) -> None:
        tag_lower = tag.lower()
        if tag_lower in {"script", "noscript"}:
            self.in_script = True
        elif tag_lower == "style":
            self.in_style = True
        elif tag_lower == "title":
            self.in_title = True
        elif tag_lower == "meta":
            attr_dict = {k.lower(): (v or "") for k, v in attrs}
            name = attr_dict.get("name") or attr_dict.get("property") or ""
            content = attr_dict.get("content") or ""
            if name and content:
                self.meta_tags[name.lower()] = content.strip()
        attr_dict = {k.lower(): (v or "") for k, v in attrs}
        if tag_lower == "a":
            href = attr_dict.get("href")
            if href:
                self.links.append(href)
        # Check any attribute (e.g. onclick, data-href, src, alt) containing social URLs
        for v in attr_dict.values():
            if "linkedin.com/in/" in v or "github.com/" in v:
                self.links.append(v)

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower in {"script", "noscript"}:
            self.in_script = False
        elif tag_lower == "style":
            self.in_style = False
        elif tag_lower == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_script or self.in_style:
            return
        if self.in_title:
            self.title_parts.append(data)
        else:
            cleaned = data.strip()
            if cleaned:
                self.text_chunks.append(cleaned)


class PortfolioExtractor:
    """Safe, sandboxed extraction of candidate portfolio and website profile details."""

    COMMON_SKILLS = [
        "python", "javascript", "typescript", "react", "next.js", "vue", "angular",
        "node.js", "fastapi", "django", "flask", "java", "c++", "c#", "golang", "rust",
        "sql", "postgresql", "mysql", "mongodb", "oracle", "redis", "docker", "kubernetes",
        "aws", "gcp", "azure", "playwright", "selenium", "graphql", "rest api", "restful api",
        "tailwind", "html", "css", "git", "ci/cd", "linux", "ai/ml", "machine learning", "dsa", "oops"
    ]

    @classmethod
    async def extract_from_url(cls, raw_url: str) -> Dict[str, Any]:
        """Fetch and extract profile hints from a public portfolio URL with strict SSRF defenses."""
        validated_url = validate_safe_url(raw_url)

        parsed_url = urllib.parse.urlparse(validated_url)
        hostname_clean = (parsed_url.hostname or "").lower()

        # Reject raw LinkedIn URLs with actionable guidance (LinkedIn blocks public HTTP bots with HTTP 999)
        if "linkedin.com" in hostname_clean:
            raise ValueError(
                "LinkedIn URLs cannot be extracted directly via public web crawling. "
                "Please export your LinkedIn profile as a PDF ('More' → 'Save to PDF') and upload it under Resume, "
                "or use your personal portfolio or GitHub URL."
            )

        # Fetch URL safely with size and timeout guards
        html_content = ""
        current_url = validated_url

        try:
            async with httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT_SECONDS,
                follow_redirects=False,
                headers={
                    "User-Agent": "RolePilot-ProfileAuditor/1.0 (+https://rolepilot.com)",
                    "Accept": "text/html,application/xhtml+xml",
                },
            ) as client:
                redirect_count = 0
                while redirect_count <= MAX_REDIRECTS:
                    resp = await client.get(current_url)

                    # Handle safe redirects
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            raise ValueError("Redirect response missing Location header.")
                        redirect_count += 1
                        if redirect_count > MAX_REDIRECTS:
                            raise ValueError(f"Too many redirects (maximum {MAX_REDIRECTS} allowed).")
                        # Resolve relative redirect
                        current_url = urllib.parse.urljoin(current_url, location)
                        current_url = validate_safe_url(current_url)
                        continue

                    # Verify successful response
                    if resp.status_code >= 400:
                        raise ValueError(f"HTTP error {resp.status_code} while accessing portfolio URL.")

                    # Content-type check
                    content_type = resp.headers.get("content-type", "").lower()
                    if not any(t in content_type for t in ["text/html", "application/xhtml+xml"]):
                        raise ValueError(f"Unsupported content type '{content_type}'. Only HTML pages can be processed.")

                    # Size check
                    if len(resp.content) > MAX_PAGE_SIZE:
                        raise ValueError(f"Portfolio page size exceeds allowed limit of {MAX_PAGE_SIZE // (1024*1024)} MB.")

                    html_content = resp.text
                    break

                if not html_content or not html_content.strip():
                    raise ValueError("Empty response received from portfolio URL.")

        except (httpx.TimeoutException, socket.timeout):
            raise ValueError("Connection timed out while fetching portfolio page. Please check URL accessibility.")
        except httpx.RequestError as exc:
            raise ValueError(f"Network error while retrieving portfolio: {exc}")

        # Parse HTML safely
        parser = SafeHTMLTextExtractor()
        try:
            parser.feed(html_content)
        except Exception:
            pass

        title = " ".join(parser.title_parts).strip()
        description = (
            parser.meta_tags.get("description")
            or parser.meta_tags.get("og:description")
            or parser.meta_tags.get("twitter:description")
            or ""
        )
        author = parser.meta_tags.get("author") or ""

        # Extract social & external links from both parsed links and full raw HTML
        github_url: Optional[str] = None
        linkedin_url: Optional[str] = None
        all_candidate_links = list(parser.links)
        raw_links = re.findall(
            r"https?://(?:www\.)?(?:linkedin\.com/in/[a-zA-Z0-9_-]+|github\.com/[a-zA-Z0-9_-]+)",
            html_content,
        )
        all_candidate_links.extend(raw_links)

        for link in all_candidate_links:
            clean_link = link.strip().strip("'\"")
            if not github_url and ("github.com/" in clean_link) and not clean_link.endswith("github.com/"):
                gh_m = re.search(r"https?://(?:www\.)?github\.com/[a-zA-Z0-9_-]+/?", clean_link, re.IGNORECASE)
                if gh_m:
                    github_url = gh_m.group(0)
            if not linkedin_url and ("linkedin.com/in/" in clean_link):
                li_m = re.search(r"https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?", clean_link, re.IGNORECASE)
                if li_m:
                    linkedin_url = li_m.group(0)

        # Multi-strategy candidate name extraction:
        # 1. Meta author
        # 2. Heading tag with title class: <h3 class="title">Name <br> Role</h3>
        # 3. "Hello, I'm [Name]" pattern in hero text
        # 4. GitHub subdomain (e.g. anil-kushwaha-2002.github.io)
        # 5. Title tag
        first_name: Optional[str] = None
        last_name: Optional[str] = None
        extracted_role_from_hero: Optional[str] = None

        if author and len(author.split()) <= 4:
            parts = author.strip().split()
            first_name = parts[0]
            if len(parts) > 1:
                last_name = " ".join(parts[1:])

        if not first_name:
            hero_title_match = re.search(
                r"<h[1-3][^>]*class=[\"'][^\"']*title[^\"']*[\"'][^>]*>\s*([A-Za-z\s]+?)\s*<[bB][rR]\s*/?>\s*([A-Za-z\s]+?)\s*</h[1-3]>",
                html_content,
                re.IGNORECASE,
            )
            if hero_title_match:
                name_str = hero_title_match.group(1).strip()
                extracted_role_from_hero = hero_title_match.group(2).strip()
                name_parts = name_str.split()
                if 2 <= len(name_parts) <= 4:
                    first_name = name_parts[0]
                    last_name = " ".join(name_parts[1:])

        if not first_name:
            hello_match = re.search(
                r"(?:Hello|Hi|Hey),\s*(?:I am|I'm|I’m)\s+([A-Za-z]+(?:\s+[A-Za-z]+){1,3})",
                html_content,
                re.IGNORECASE,
            )
            if hello_match:
                name_parts = hello_match.group(1).strip().split()
                if 2 <= len(name_parts) <= 4:
                    first_name = name_parts[0]
                    last_name = " ".join(name_parts[1:])

        if not first_name and "github.io" in hostname_clean:
            subdomain = hostname_clean.split(".github.io")[0]
            subdomain_clean = re.sub(r"-\d+$", "", subdomain)
            parts = [p.capitalize() for p in subdomain_clean.split("-") if p]
            if 2 <= len(parts) <= 4:
                first_name = parts[0]
                last_name = " ".join(parts[1:])

        if not first_name and title:
            cleaned_title = re.split(r"[-|•—]", title)[0].strip()
            title_parts = cleaned_title.split()
            if 2 <= len(title_parts) <= 3 and not any(
                w in cleaned_title.lower() for w in ["portfolio", "home", "developer", "engineer", "my"]
            ):
                first_name = title_parts[0]
                last_name = " ".join(title_parts[1:])

        # Detect headline / target role
        headline: Optional[str] = extracted_role_from_hero
        if not headline and description:
            headline = description.split(".")[0].strip()[:100]
        elif not headline and title and ("|" in title or "-" in title):
            parts = re.split(r"[-|•—]", title)
            if len(parts) > 1:
                candidate_role = parts[1].strip()
                if 5 <= len(candidate_role) <= 60:
                    headline = candidate_role

        # Detect contact details (email and phone)
        email: Optional[str] = None
        emails = re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", html_content)
        for em in emails:
            if not any(ign in em.lower() for ign in ["example", "sample", "test@", "domain.com", "yoursite"]):
                email = em.lower()
                break

        phone: Optional[str] = None
        phones = re.findall(r"\b(?:\+?\d{1,3}[-.\s]?)?\d{10}\b", html_content)
        if phones:
            phone = phones[0].strip()

        # Detect experience and education hints
        experiences: List[Dict[str, Any]] = []
        experience_years = 0
        exp_match = re.search(r"(\d+)\s*\+\s*years?\s*(?:<br\s*/?>|\s+)\s*([A-Za-z\s]+)", html_content, re.IGNORECASE)
        if exp_match:
            try:
                experience_years = int(exp_match.group(1))
            except ValueError:
                experience_years = 2
            role_hint = exp_match.group(2).strip()
            experiences.append({
                "job_title": role_hint if len(role_hint) < 50 else (headline or "Software Developer"),
                "company_name": "Industry Professional",
                "start_date": f"{2026 - experience_years}-01-01",
                "end_date": None,
                "description": f"Extracted from portfolio: {experience_years}+ years in {role_hint}",
                "source": "portfolio",
            })

        educations: List[Dict[str, Any]] = []
        edu_match = re.search(r"(B\.?Tech|B\.?E\.?|BCA|MCA|M\.?Tech|B\.?S\.?|Master)\s*(?:<br\s*/?>|\s+)\s*([A-Za-z\s]+)", html_content, re.IGNORECASE)
        if edu_match:
            degree_hint = edu_match.group(1).strip()
            field_hint = edu_match.group(2).strip()
            educations.append({
                "institution": "University / Institute",
                "degree": degree_hint,
                "field_of_study": field_hint,
                "start_year": None,
                "end_year": "2024",
                "source": "portfolio",
            })

        # Detect tech skills
        full_page_text = " ".join(parser.text_chunks).lower()
        skills_detected: List[Dict[str, Any]] = []
        for skill in cls.COMMON_SKILLS:
            pattern = r"\b" + re.escape(skill) + r"\b"
            if re.search(pattern, full_page_text):
                skills_detected.append({
                    "name": skill.title() if skill not in {"aws", "gcp", "sql", "html", "css", "ci/cd", "ai/ml", "dsa", "oops"} else skill.upper(),
                    "years": experience_years or 1,
                    "months": 0,
                    "source": "portfolio",
                })

        return {
            "source": "portfolio",
            "url": validated_url,
            "title": title,
            "first_name": first_name,
            "last_name": last_name,
            "headline": headline,
            "about": description if description else None,
            "email": email,
            "phone": phone,
            "website_url": validated_url,
            "github_url": github_url,
            "linkedin_url": linkedin_url,
            "experience_years": experience_years,
            "skills": skills_detected,
            "experiences": experiences,
            "educations": educations,
        }
