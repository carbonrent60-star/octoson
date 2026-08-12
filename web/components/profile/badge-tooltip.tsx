"use client";

import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export default function BadgeTooltip({
  children,
  content,
  label,
}: {
  children: ReactNode;
  content: ReactNode;
  label: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    placement: "top" as "top" | "bottom",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  function updatePosition() {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;

    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const gap = 8;
    const edge = 10;

    let left =
      triggerRect.left +
      triggerRect.width / 2 -
      tooltipRect.width / 2;

    left = Math.max(
      edge,
      Math.min(
        left,
        window.innerWidth - tooltipRect.width - edge
      )
    );

    const enoughAbove =
      triggerRect.top >= tooltipRect.height + gap + edge;

    const placement = enoughAbove ? "top" : "bottom";

    const top =
      placement === "top"
        ? triggerRect.top - tooltipRect.height - gap
        : triggerRect.bottom + gap;

    setPosition({
      left,
      top,
      placement,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();

    const handler = () => updatePosition();

    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);

    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-label={label}
        className="inline-flex shrink-0 items-center justify-center outline-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>

      {mounted && open
        ? createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              data-placement={position.placement}
              className="octosonBadgePortal"
              style={{
                left: position.left,
                top: position.top,
              }}
            >
              {content}

              <style jsx>{`
                .octosonBadgePortal {
                  position: fixed;
                  z-index: 2147483647;

                  width: 232px;

                  opacity: 0;

                  pointer-events: none;

                  animation:
                    octosonTooltipIn
                    180ms
                    cubic-bezier(.16, 1, .3, 1)
                    forwards;

                  will-change:
                    transform,
                    opacity;
                }

                .octosonBadgePortal[data-placement="top"] {
                  transform-origin: bottom center;
                }

                .octosonBadgePortal[data-placement="bottom"] {
                  transform-origin: top center;
                }


                @keyframes octosonTooltipIn {
                  from {
                    opacity: 0;
                    transform:
                      translateY(
                        ${position.placement === "top"
                          ? "7px"
                          : "-7px"}
                      )
                      scale(.965);
                  }

                  to {
                    opacity: 1;
                    transform:
                      translateY(0)
                      scale(1);
                  }
                }

                @media (prefers-reduced-motion: reduce) {
                  .octosonBadgePortal {
                    animation: none;
                    opacity: 1;
                  }
                }
              `}</style>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
