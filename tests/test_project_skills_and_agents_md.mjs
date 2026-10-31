import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Project Instructions: Root AGENTS.md exists with verified stack, commands, and security rules', () => {
  const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
  assert.ok(fs.existsSync(agentsMdPath), 'Root AGENTS.md must exist');

  const content = fs.readFileSync(agentsMdPath, 'utf8');

  // Architecture & Stack
  assert.match(content, /RolePilot/i, 'Must reference RolePilot product');
  assert.match(content, /React 19/, 'Must reference confirmed React 19 frontend');
  assert.match(content, /FastAPI/, 'Must reference confirmed FastAPI backend');
  assert.match(content, /Playwright/, 'Must reference Playwright automation engine');
  assert.match(content, /index\.css/, 'Must reference design tokens in index.css');

  // Verified commands
  assert.match(content, /node --test tests\/\*\.mjs/, 'Must document Node.js test command');
  assert.match(content, /npm --prefix frontend run lint/, 'Must document frontend lint command');
  assert.match(content, /npm --prefix frontend run build/, 'Must document frontend build command');
  assert.match(content, /PYTHONPATH=\.:src pytest/, 'Must document backend pytest command with proper pythonpath');

  // Triple-Key Live-Submission Guard
  assert.match(content, /Triple-Key Live-Submission Safety Guard/, 'Must highlight Triple-Key guard');
  assert.match(content, /dry_run/, 'Must document dry_run key');
  assert.match(content, /allow_live_submission/, 'Must document allow_live_submission key');
  assert.match(content, /CONFIRM_REAL_SUBMISSION/, 'Must document sentinel confirmation string');

  // Safety & Deployment rules
  assert.match(content, /NEVER submit real applications/, 'Must forbid real submissions in tests');
  assert.match(content, /Do NOT deploy to production/, 'Must forbid unauthorized production deployment');
});

test('Project Skills System: All 7 specialized skills exist in .agents/skills/ with valid frontmatter', () => {
  const skillsDir = path.join(projectRoot, '.agents', 'skills');
  assert.ok(fs.existsSync(skillsDir), '.agents/skills directory must exist');

  const expectedSkills = [
    'rolepilot-pm',
    'rolepilot-architecture',
    'rolepilot-frontend-ux',
    'rolepilot-backend-engineer',
    'rolepilot-sdet',
    'rolepilot-security',
    'rolepilot-maintenance',
  ];

  for (const skillName of expectedSkills) {
    const skillPath = path.join(skillsDir, skillName, 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), `${skillName}/SKILL.md must exist`);

    const content = fs.readFileSync(skillPath, 'utf8');

    // Frontmatter validation
    assert.ok(content.startsWith('---\n'), `${skillName} must start with YAML frontmatter delimiter`);
    assert.match(content, new RegExp(`name:\\s*${skillName}`), `${skillName} frontmatter must declare matching name`);
    assert.match(content, /description:\s*>-?[\s\S]+?---/, `${skillName} frontmatter must include description`);

    // Standard structural sections
    assert.match(content, /## 1\.\s*Activation Conditions/, `${skillName} must define Activation Conditions`);
    assert.match(content, /## 2\.\s*Required Inspection Steps/, `${skillName} must define Inspection Steps`);
    assert.match(content, /## 3\.\s*Decision Rules/, `${skillName} must define Decision Rules`);
    assert.match(content, /## 4\.\s*Implementation Workflow/, `${skillName} must define Implementation Workflow`);
    assert.match(content, /## 5\.\s*Verification & Acceptance Criteria/, `${skillName} must define Verification Criteria`);
    assert.match(content, /## 6\.\s*Final Report Format/, `${skillName} must define Final Report Format`);
  }
});
