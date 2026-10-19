"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrCode({ value, size = 176 }: { value: string; size?: number }) {
  return (
    <div className="inline-block rounded-xl bg-white p-3 shadow-sm">
      <QRCodeSVG value={value} size={size} />
    </div>
  );
}
