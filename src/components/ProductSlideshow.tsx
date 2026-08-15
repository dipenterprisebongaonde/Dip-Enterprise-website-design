
"use client";

import { useEffect, useState } from "react";

const slides = [
  {
    title: "Operations Cloud",
    copy: "Sales, purchases, vendors, and customers in one branch-aware workspace.",
    image:
      "linear-gradient(135deg, rgba(20,18,12,.55), rgba(10,12,16,.75)), url('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80')",
  },
  {
    title: "Inventory Management",
    copy: "SKU control, low-stock alerts, category filters, and stock in/out adjustments.",
    image:
      "linear-gradient(135deg, rgba(20,18,12,.55), rgba(10,12,16,.75)), url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80')",
  },
  {
    title: "CCTV Monitoring",
    copy: "Watch every gate, yard, and warehouse feed from a single admin console.",
    image:
      "linear-gradient(135deg, rgba(20,18,12,.55), rgba(10,12,16,.75)), url('https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=1600&q=80')",
  },
  {
    title: "Live Car Tracking",
    copy: "GPS status, driver assignment, and route history for your fleet.",
    image:
      "linear-gradient(135deg, rgba(20,18,12,.55), rgba(10,12,16,.75)), url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1600&q=80')",
  },
];

export function ProductSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[index];

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-[1.4rem] border border-[var(--line)] shadow-[var(--shadow)]">
      <div
        key={slide.title}
        className="absolute inset-0 hero-media slide-enter bg-cover bg-center"
        style={{ backgroundImage: slide.image }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#151b2e]/90 via-[#151b2e]/25 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c7b8ff]">
          Product suite
        </p>
        <h3 className="mt-2 text-2xl font-bold text-white md:text-3xl">{slide.title}</h3>
        <p className="mt-2 max-w-xl text-sm text-white/75 md:text-base">{slide.copy}</p>
        <div className="mt-4 flex gap-2">
          {slides.map((item, i) => (
            <button
              key={item.title}
              aria-label={`Show ${item.title}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 w-8 rounded-full transition ${
                i === index ? "bg-[var(--accent)]" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
