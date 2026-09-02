/**
 * Six-box SMS code entry.
 *
 * Handles what people actually do with a code: type it, paste all six digits
 * at once, backspace through it, and let the browser autofill it from the SMS
 * (`autocomplete="one-time-code"`, which iOS and Android both honour).
 *
 * DELETION IS THE HARD PART, and it is worth knowing why before touching it.
 * Most Android soft keyboards do not report backspace as a key: it arrives at
 * `keydown` as `Unidentified`, so a handler that tests `event.key` never sees
 * it. A `change` event is no help either, because an input that is already
 * empty does not change when you press backspace on it — and after typing five
 * digits, the focused box is the empty sixth. So on the devices most of this
 * site's visitors use, the row could not be corrected at all.
 *
 * The `beforeinput` event is what all three engines do agree on: it fires with
 * `inputType === 'deleteContentBackward'` whether the box has a digit in it or
 * not. It is attached natively rather than through React, whose synthetic
 * `onBeforeInput` predates the standard event and does not fire for deletions.
 * `keydown` stays as the hardware-keyboard path, and both call the same
 * `deleteAt`, so a code behaves identically however it is being typed.
 */

import React, { useCallback, useEffect, useRef } from 'react';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  /**
   * Blocks typing while the code is being checked.
   *
   * Deliberately NOT the `disabled` attribute. The request starts on the sixth
   * keystroke, with the caret in the sixth box, and disabling a focused
   * element blurs it — so the keyboard slammed shut mid-verification and focus
   * fell to `<body>`, which is exactly where a rejected code then left the
   * visitor: six empty boxes, no caret, and a tap needed to start again.
   */
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label: string;
  /** Ties the boxes to the error banner, so the reason is reachable from them. */
  describedBy?: string;
}

export const CodeInput: React.FC<CodeInputProps> = ({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = true,
  label,
  describedBy,
}) => {
  const groupRef = useRef<HTMLDivElement>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const completedFor = useRef<string | null>(null);
  const hadValue = useRef(value.length > 0);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  /**
   * A code that was wiped from outside is a rejected code, and the visitor is
   * about to retype it. Nothing else empties a full row at once, and without
   * this they were left staring at six empty boxes with the caret nowhere.
   */
  useEffect(() => {
    if (hadValue.current && !value) inputs.current[0]?.focus();
    hadValue.current = value.length > 0;
  }, [value]);

  // Fire once per completed value, not on every re-render of that value.
  useEffect(() => {
    if (value.length === length && completedFor.current !== value) {
      completedFor.current = value;
      onComplete?.(value);
    }
    if (value.length < length) completedFor.current = null;
  }, [value, length, onComplete]);

  /**
   * Deletes backwards from `index`, the way one text field would.
   *
   * A box with a digit in it loses that digit and keeps the caret, so the
   * replacement lands where the mistake was. Stepping back here instead — as
   * an earlier version did — put the caret on a box that still held a good
   * digit, and typing the correction overwrote it: fixing one wrong digit
   * quietly destroyed another and left the code a digit short.
   *
   * A box that is already empty deletes the one before it and follows it, so
   * holding backspace clears the row.
   */
  const deleteAt = useCallback(
    (index: number) => {
      if (disabled) return;
      if (value[index] !== undefined) {
        onChange(value.slice(0, index) + value.slice(index + 1));
        return;
      }
      if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        inputs.current[index - 1]?.focus();
      }
    },
    [disabled, value, onChange],
  );

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    const onBeforeInput = (event: Event) => {
      const input = event as InputEvent;
      if (input.inputType !== 'deleteContentBackward') return;
      const index = inputs.current.indexOf(event.target as HTMLInputElement);
      if (index < 0) return;
      // Taken over entirely: the browser's own deletion would only ever empty
      // the one box, and on an empty box would do nothing at all.
      event.preventDefault();
      deleteAt(index);
    };
    node.addEventListener('beforeinput', onBeforeInput);
    return () => node.removeEventListener('beforeinput', onBeforeInput);
  }, [deleteAt]);

  /**
   * Writes one digit, at `index` or at the first empty box if that is sooner.
   *
   * A code has no holes in it, so a tap on box 5 of a row with two digits in
   * it means "carry on typing", not "leave a gap". The old version padded the
   * gap with spaces and then stripped every space out again, which closed it
   * instead of filling it: the digit landed several boxes to the left of the
   * one that had been tapped.
   */
  const setDigit = (index: number, digit: string) => {
    const at = Math.min(index, value.length);
    const next = value.slice(0, at) + digit + value.slice(at + 1);
    onChange(next.slice(0, length));
    if (at < length - 1) inputs.current[at + 1]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    if (disabled) return;
    const digits = raw.replace(/\D/g, '');

    // The fallback deletion path, for anything that does not emit
    // `beforeinput`. The handler above prevents the event that would reach
    // here, so on every current browser this does not run.
    if (!digits) {
      deleteAt(index);
      return;
    }

    if (digits.length > 1) {
      // Pasted or autofilled: spread across the boxes from here.
      const merged = (value.slice(0, index) + digits).slice(0, length);
      onChange(merged);
      inputs.current[Math.min(merged.length, length - 1)]?.focus();
      return;
    }

    setDigit(index, digits);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      deleteAt(index);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    if (disabled) return;
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (digits) {
      onChange(digits);
      inputs.current[Math.min(digits.length, length - 1)]?.focus();
    }
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={label}
      aria-busy={disabled || undefined}
      // A grid rather than a centred flex row: as flex items with a definite
      // `w-11`, the boxes could not shrink, and six of them plus five gaps came
      // to 304px inside a 288px column on a 320px phone — a row that hung over
      // both gutters. Six equal columns fit whatever width there is.
      className="mx-auto grid w-full max-w-xs grid-cols-6 gap-1.5 sm:max-w-sm sm:gap-2.5"
      onPaste={handlePaste}
    >
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          // Lets the OS offer the code straight from the SMS notification.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[index] ?? ''}
          readOnly={disabled}
          aria-label={`${label} ${index + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          className={`h-13 w-full min-w-0 rounded-xl border-2 bg-surface-2 text-center text-xl
            font-black text-content transition-all focus:bg-surface focus:outline-none
            sm:h-14 sm:text-2xl
            ${disabled ? 'opacity-60' : ''}
            ${
              invalid
                ? 'border-danger'
                : value[index]
                  ? 'border-brand'
                  : 'border-line focus:border-brand'
            }`}
        />
      ))}
    </div>
  );
};
