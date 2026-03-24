"use client";

import { motion } from "framer-motion";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
  href?: string;
}

const cardMotion = {
  rest: { scale: 1, boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)" },
  hover: { scale: 1.02, boxShadow: "0 10px 40px -10px rgba(15, 23, 42, 0.12)" },
  tap: { scale: 0.99 },
};

export default function AnimatedCard({
  children,
  className,
  as: Component = "div",
  href,
}: AnimatedCardProps) {
  const motionProps = {
    initial: "rest",
    whileHover: "hover",
    whileTap: "tap",
    variants: cardMotion,
    transition: { type: "spring", stiffness: 400, damping: 25 },
    className,
  };

  if (href) {
    return (
      <motion.a href={href} {...motionProps}>
        {children}
      </motion.a>
    );
  }

  return <motion.div {...motionProps}>{children}</motion.div>;
}
