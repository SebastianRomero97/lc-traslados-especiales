import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'outline' | 'whatsapp';

type BaseProps = {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: 'button';
    href?: never;
  };

type ButtonAsLink = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: 'a';
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

function buildClassName(variant: ButtonVariant, fullWidth: boolean, className?: string) {
  return ['btn', `btn--${variant}`, fullWidth ? 'btn--full' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}

export function Button(props: ButtonProps) {
  const { variant = 'primary', fullWidth = false, children, className } = props;

  if (props.as === 'a') {
    const { as: _, href, variant: __, fullWidth: ___, className: ____, ...linkProps } = props;
    return (
      <a href={href} className={buildClassName(variant, fullWidth, className)} {...linkProps}>
        {children}
      </a>
    );
  }

  const { as: _, variant: __, fullWidth: ___, className: ____, children: _____, ...buttonProps } =
    props;
  return (
    <button
      type={buttonProps.type ?? 'button'}
      className={buildClassName(variant, fullWidth, className)}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
