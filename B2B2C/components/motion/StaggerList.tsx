"use client";

import { Children, isValidElement, ReactNode } from "react";
import { motion } from "framer-motion";

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: (staggerDelay: number) => ({
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.05,
    },
  }),
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function StaggerList({
  children,
  className,
  staggerDelay = 0.08,
}: StaggerListProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      custom={staggerDelay}
      className={className}
    >
      {Children.map(children, (child, i) =>
        isValidElement(child) ? (
          <motion.div key={i} variants={itemVariants} transition={{ duration: 0.3 }}>
            {child}
          </motion.div>
        ) : (
          child
        )
      )}
    </motion.div>
  );
}
