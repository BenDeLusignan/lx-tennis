"use client";

import { useEffect, useState } from "react";
import { formatTension, TENSION_LIMITS } from "@/data/units";
import styles from "./page.module.css";

interface TensionHintProps {
  /** Its own id, for the tension input's `aria-describedby`. */
  id: string;
  /** The tension input it describes. */
  inputId: string;
}

/**
 * The live "= 24.9 kg" under a tension field (Product rule 6: the other
 * unit, rounded to 1 decimal place, exactly as the setup card will show
 * it). It follows both the number and the form's lb/kg choice. Empty until
 * JavaScript loads; its line is reserved so the form doesn't jump when it
 * fills in.
 */
export function TensionHint({ id, inputId }: TensionHintProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    const input = document.getElementById(inputId);
    const form = input instanceof HTMLInputElement ? input.form : null;
    if (!(input instanceof HTMLInputElement) || !form) return;

    const update = () => {
      const unit = (form.elements.namedItem("tensionUnit") as RadioNodeList | null)?.value;
      setText(hintText(input.valueAsNumber, unit));
    };

    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, [inputId]);

  return (
    <output id={id} htmlFor={inputId} className={styles.hint}>
      {text}
    </output>
  );
}

function hintText(value: number, unit: string | undefined): string {
  if (Number.isNaN(value)) return "";
  if (unit !== "lb" && unit !== "kg") return "Choose lb or kg above.";
  const { min, max } = TENSION_LIMITS[unit];
  if (value < min || value > max) return `Between ${min} and ${max} ${unit}`;
  return `= ${formatTension(value, unit).other}`;
}
