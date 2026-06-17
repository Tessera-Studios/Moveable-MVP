import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

function CardRoot({
  children,
  className = "",
  padding = true,
}: CardProps): React.ReactElement {
  return (
    <div
      className={[
        "bg-card rounded-card shadow-card",
        padding ? "p-4" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={["border-b border-border p-4", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={["p-4", className].filter(Boolean).join(" ")}>{children}</div>
  );
}

function CardFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={["border-t border-border p-4", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
