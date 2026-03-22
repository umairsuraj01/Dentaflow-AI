import { useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';

interface SwipeAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  color: string;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  actions: SwipeAction[];
}

export function SwipeableCard({ children, actions }: SwipeableCardProps) {
  const controls = useAnimation();
  const x = useMotionValue(0);
  const actionsWidth = actions.length * 80;
  const containerRef = useRef<HTMLDivElement>(null);

  // Map drag x to actions container opacity for a reveal effect
  const actionsOpacity = useTransform(x, [-actionsWidth, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipedFarEnough = info.offset.x < -80 || info.velocity.x < -500;
    if (swipedFarEnough) {
      controls.start({ x: -actionsWidth, transition: { type: 'spring', stiffness: 300, damping: 30 } });
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
    }
  };

  const handleActionClick = (action: SwipeAction) => {
    action.onClick();
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* Action buttons revealed on swipe */}
      <motion.div
        className="absolute inset-y-0 right-0 flex"
        style={{ opacity: actionsOpacity }}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => handleActionClick(action)}
              className="flex w-20 flex-col items-center justify-center gap-1 text-white"
              style={{ backgroundColor: action.color }}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{action.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Draggable card content */}
      <motion.div
        className="relative z-10 bg-white"
        drag="x"
        dragConstraints={{ left: -actionsWidth, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
      >
        {children}
      </motion.div>
    </div>
  );
}
