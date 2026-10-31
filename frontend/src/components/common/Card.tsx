import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, interactive = false, className = '', onClick, ...rest }) => (
  <div
    className={`card ${interactive ? 'card-interactive' : ''} ${className}`.trim()}
    onClick={onClick}
    role={interactive && onClick ? 'button' : rest.role}
    tabIndex={interactive && onClick ? (rest.tabIndex ?? 0) : rest.tabIndex}
    onKeyDown={
      interactive && onClick
        ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
            }
            rest.onKeyDown?.(e);
          }
        : rest.onKeyDown
    }
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className = '', ...rest }) => (
  <div className={`card-header ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<CardProps & { icon?: React.ReactNode }> = ({
  icon,
  children,
  className = '',
  ...rest
}) => (
  <h3 className={`card-title ${className}`.trim()} {...rest}>
    {icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>}
    <span>{children}</span>
  </h3>
);

export const CardBody: React.FC<CardProps> = ({ children, className = '', ...rest }) => (
  <div className={`card-body ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardFooter: React.FC<CardProps> = ({ children, className = '', ...rest }) => (
  <div
    className={`card-footer ${className}`.trim()}
    style={{
      padding: '16px 24px',
      borderTop: '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '12px',
      backgroundColor: 'var(--bg-subtle)',
    }}
    {...rest}
  >
    {children}
  </div>
);
