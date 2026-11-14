import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "./api.js";

type User = { id: number; fullName: string; email: string; role: string };
type Reservation = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  numberOfGuests: number;
  reservationDate: string;
  reservationTime: string;
  specialRequests: string | null;
  isConfirmed: boolean;
  paymentStatus: string;
  paymentMethod: string;
  paymentAmount: number;
};
type ApiError = {
  error?: { message?: string; fields?: Record<string, string[]> };
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ReservationPage({
  user,
  reservationId,
}: {
  user: User | null;
  reservationId?: string;
}) {
  const isCreate =
    window.location.pathname.replace(/\/$/, "") === "/reservations/create";
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  useEffect(() => {
    if (!reservationId) return;
    apiFetch(`/api/v1/reservations/${encodeURIComponent(reservationId)}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          reservation?: Reservation;
        } & ApiError;
        if (response.status === 401) {
          window.location.assign(
            `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`,
          );
          return;
        }
        if (!response.ok || !body.reservation)
          throw new Error(body.error?.message || "Reservation not found.");
        setReservation(body.reservation);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Reservation is temporarily unavailable.",
        ),
      );
  }, [reservationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const date = String(data.get("reservationDate") || "");
    const time = String(data.get("reservationTime") || "");
    const localDateTime = new Date(`${date}T${time}:00`);
    if (Number.isNaN(localDateTime.getTime())) {
      setError("Choose a valid date and time.");
      setSubmitting(false);
      return;
    }
    try {
      const response = await apiFetch("/api/v1/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          phoneNumber: String(data.get("phoneNumber") || ""),
          reservationDate: date,
          reservationTime: time,
          reservationDateTime: localDateTime.toISOString(),
          timezoneOffsetMinutes: localDateTime.getTimezoneOffset(),
          numberOfGuests: Number(data.get("numberOfGuests")),
          specialRequests: String(data.get("specialRequests") || ""),
        }),
      });
      const body = (await response.json()) as {
        reservation?: Reservation;
      } & ApiError;
      if (response.status === 401) {
        window.location.assign("/login?returnUrl=%2Freservations%2Fcreate");
        return;
      }
      if (!response.ok || !body.reservation)
        throw new Error(
          body.error?.message || "We could not save your reservation request.",
        );
      window.location.assign(`/reservations/${body.reservation.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not reach the reservation service.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (reservationId) {
    if (error)
      return (
        <section className="reservation-page">
          <div className="reservation-panel reservation-result">
            <div className="reservation-alert error" role="alert">
              {error}
            </div>
            <a className="reservation-button" href="/reservations">
              Back to Reservations
            </a>
          </div>
        </section>
      );
    if (!reservation)
      return (
        <section className="reservation-page">
          <div className="reservation-panel reservation-result">
            <div className="loading-spinner" role="status">
              <span className="spinner" />
              <span>Loading reservation…</span>
            </div>
          </div>
        </section>
      );
    return (
      <section className="reservation-page">
        <div className="reservation-panel reservation-result">
          <div className="reservation-result-icon" aria-hidden="true">
            ✓
          </div>
          <p className="reservation-eyebrow">REQUEST RECEIVED</p>
          <h1>Your reservation request is saved</h1>
          <p className="reservation-status-note">
            Your table is not confirmed yet. Please pay the ₹500 reservation fee
            at the cafe to confirm it.
          </p>
          <div className="reservation-details">
            <div>
              <span>Reference</span>
              <strong>AHC-R{String(reservation.id).padStart(6, "0")}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>
                {reservation.isConfirmed ? "Confirmed" : "Pending"}
              </strong>
            </div>
            <div>
              <span>Name</span>
              <strong>{reservation.name}</strong>
            </div>
            <div>
              <span>Guests</span>
              <strong>{reservation.numberOfGuests}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{reservation.reservationDate}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{reservation.reservationTime}</strong>
            </div>
            <div>
              <span>Payment</span>
              <strong>
                ₹{reservation.paymentAmount.toFixed(2)} ·{" "}
                {reservation.paymentStatus}
              </strong>
            </div>
          </div>
          {reservation.specialRequests && (
            <p className="reservation-special">
              <strong>Special requests:</strong> {reservation.specialRequests}
            </p>
          )}
          <a className="reservation-button" href="/reservations">
            Return to Reservations
          </a>
        </div>
      </section>
    );
  }

  if (isCreate)
    return (
      <section className="reservation-page">
        <div className="reservation-page-inner">
          <header className="reservation-page-heading">
            <p className="reservation-eyebrow">ALL HOURS CAFE</p>
            <h1>Make a Reservation</h1>
            <p>
              Please share your details and preferred time. Reservations are
              subject to confirmation.
            </p>
          </header>
          {!user ? (
            <div className="reservation-panel reservation-result">
              <h2>Sign in to request a table</h2>
              <p>Your reservation details will be linked to your account.</p>
              <a
                className="reservation-button"
                href="/login?returnUrl=%2Freservations%2Fcreate"
              >
                Sign In
              </a>
            </div>
          ) : (
            <form className="reservation-form-card" onSubmit={submit}>
              {error && (
                <div className="reservation-alert error" role="alert">
                  {error}
                </div>
              )}
              <div className="reservation-fields">
                <label>
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    defaultValue={user.fullName}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    value={user.email}
                    readOnly
                  />
                </label>
                <label>
                  Phone number
                  <input
                    name="phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    required
                    minLength={5}
                    maxLength={50}
                    placeholder="Enter your phone number"
                  />
                </label>
                <label>
                  Reservation date
                  <input
                    name="reservationDate"
                    type="date"
                    min={localDate(new Date())}
                    defaultValue={localDate(tomorrow)}
                    required
                  />
                </label>
                <label>
                  Reservation time
                  <input
                    name="reservationTime"
                    type="time"
                    defaultValue="18:00"
                    required
                  />
                </label>
                <label>
                  Number of guests
                  <select name="numberOfGuests" defaultValue="2">
                    {Array.from({ length: 20 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        {index + 1} {index === 0 ? "person" : "people"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="reservation-field-wide">
                  Special requests
                  <textarea
                    name="specialRequests"
                    rows={4}
                    maxLength={500}
                    placeholder="Any special requests or dietary requirements?"
                  />
                </label>
              </div>
              <div className="reservation-payment-info">
                <strong>Reservation fee: ₹500</strong>
                <span>
                  Online payment isn’t available yet. We’ll save your request as
                  pending; it is not confirmed until the payment and
                  confirmation flow is added.
                </span>
              </div>
              <div className="reservation-form-actions">
                <button
                  className="reservation-button"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Saving request…" : "Request a Reservation"}
                </button>
                <a className="reservation-cancel" href="/reservations">
                  Cancel
                </a>
              </div>
            </form>
          )}
        </div>
      </section>
    );

  return (
    <>
      <section className="reservation-intro">
        <div className="reservation-page-inner">
          <header className="reservation-page-heading">
            <p className="reservation-eyebrow">ALL HOURS CAFE</p>
            <h1>Reserve a Table</h1>
            <p>
              Make a reservation at All Hours Cafe to request a table at your
              preferred time.
            </p>
          </header>
          <div className="reservation-info-grid">
            <article className="reservation-info-card">
              <i className="fas fa-clock" aria-hidden="true" />
              <h2>Opening Hours</h2>
              <p>Monday – Friday: 8:00 AM – 10:00 PM</p>
              <p>Saturday – Sunday: 9:00 AM – 11:00 PM</p>
            </article>
            <article className="reservation-info-card">
              <i className="fas fa-phone" aria-hidden="true" />
              <h2>Contact Us</h2>
              <p>Phone: +91 123 456 7890</p>
              <p>Email: reservations@allhourscafe.com</p>
            </article>
            <article className="reservation-info-card">
              <i className="fas fa-map-marker-alt" aria-hidden="true" />
              <h2>Location</h2>
              <p>123 Cafe Street</p>
              <p>New Delhi, India 110001</p>
            </article>
          </div>
          <div className="reservation-cta">
            <a href="/reservations/create" className="reservation-button">
              Make a Reservation
            </a>
          </div>
        </div>
      </section>
      <section className="reservation-policy">
        <div className="reservation-page-inner">
          <h2>Reservation Policy</h2>
          <div className="reservation-policy-grid">
            <article>
              <h3>Cancellation</h3>
              <p>
                Reservations can be cancelled up to 2 hours before the scheduled
                time without any charges.
              </p>
            </article>
            <article>
              <h3>Late Arrival</h3>
              <p>
                We hold reservations for 15 minutes past the scheduled time.
                After that, the table may be given to other guests.
              </p>
            </article>
            <article>
              <h3>Large Groups</h3>
              <p>
                For groups of more than 8 people, please call us directly to
                make a reservation.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
