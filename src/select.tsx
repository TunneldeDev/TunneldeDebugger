import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/** Graphite listbox; never opens the operating system's select popup. */
export function Select({
  children,
  value,
  onChange,
  disabled,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const option = child as ReactElement<{
        value: string;
        disabled?: boolean;
        children: React.ReactNode;
      }>;
      return {
        value: String(option.props.value),
        label: option.props.children,
        disabled: option.props.disabled,
      };
    });
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 260,
  });
  const selected = options.findIndex(
    (option) => option.value === String(value),
  );
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value },
    } as React.ChangeEvent<HTMLSelectElement>);
    close();
  };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = trigger.current!.getBoundingClientRect();
      const height = Math.min(
        260,
        options.length * 34 + 10,
        window.innerHeight - 16,
      );
      const width = Math.min(Math.max(box.width, 170), window.innerWidth - 16);
      setPosition({
        left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
        top:
          box.bottom + height + 8 <= window.innerHeight
            ? box.bottom + 4
            : Math.max(8, box.top - height - 4),
        width,
        height,
      });
    };
    place();
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options.length]);
  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  const move = (direction: number) => {
    let next = active;
    for (let i = 0; i < options.length; i++) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) break;
    }
    setActive(next);
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={props["aria-label"]}
        title={props.title}
        value={String(value)}
        disabled={disabled}
        className={`themed-select ${className}`}
        onClick={() => {
          setActive(Math.max(0, selected));
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (
            ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            if (!open) {
              setActive(Math.max(0, selected));
              setOpen(true);
            } else if (event.key === "Enter" || event.key === " ")
              choose(active);
            else if (event.key === "Home")
              setActive(options.findIndex((option) => !option.disabled));
            else if (event.key === "End")
              setActive(options.findLastIndex((option) => !option.disabled));
            else move(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === "Tab") setOpen(false);
          else if (event.key.length === 1) {
            const index = options.findIndex(
              (option) =>
                !option.disabled &&
                String(option.label)
                  .toLowerCase()
                  .startsWith(event.key.toLowerCase()),
            );
            if (index >= 0) {
              setActive(index);
              setOpen(true);
            }
          }
        }}
      >
        <span>{options[selected]?.label ?? value}</span>
        <ChevronDown size={12} />
      </button>
      {open &&
        createPortal(
          <div
            id={id}
            ref={menu}
            role="listbox"
            aria-label={props["aria-label"]}
            className="select-menu"
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.height,
            }}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={option.value === String(value)}
                aria-disabled={!!option.disabled}
                data-value={option.value}
                data-index={index}
                className={active === index ? "highlighted" : ""}
                tabIndex={-1}
                disabled={option.disabled}
                onPointerMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === String(value) && <Check size={13} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
