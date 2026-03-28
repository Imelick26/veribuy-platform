"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Tiny page for the "Yes, I bought it" flow.
 * One field: purchase price. No login required (token-verified).
 */
export default function OutcomePurchasePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          purchasePrice: price ? parseFloat(price.replace(/[^0-9.]/g, "")) : undefined,
        }),
      });

      if (res.ok) {
        setDone(true);
      }
    } catch {
      // Silently handle — not critical
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", maxWidth: 400, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
        <h2 style={{ margin: "0 0 8px" }}>Thank you!</h2>
        <p style={{ color: "#666" }}>Your feedback helps us improve pricing accuracy.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
      <h2 style={{ margin: "0 0 8px" }}>Congratulations on the purchase!</h2>
      <p style={{ color: "#666", margin: "0 0 24px" }}>
        What did you end up paying? This helps us calibrate our pricing models.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span style={{ position: "absolute", left: 14, top: 13, color: "#999", fontSize: 18, fontWeight: 600 }}>$</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 18,500"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px 12px 30px",
              fontSize: 18,
              fontWeight: 600,
              border: "2px solid #ddd",
              borderRadius: 8,
              outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            background: submitting ? "#ccc" : "#16a34a",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving..." : "Submit"}
        </button>

        <button
          type="button"
          onClick={() => {
            // Submit without price
            setPrice("");
            handleSubmit(new Event("submit") as unknown as React.FormEvent);
          }}
          style={{
            width: "100%",
            padding: "8px",
            fontSize: 13,
            color: "#999",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Skip — I'd rather not say
        </button>
      </form>
    </div>
  );
}
