import { FormEvent, useState } from "react";

type ApiResponse = {
  message?: string;
  error?: { message?: string; fields?: Record<string, string[]> };
};

export function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          subject: String(data.get("subject") || ""),
          message: String(data.get("message") || ""),
        }),
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok)
        throw new Error(
          body.error?.message ||
            "We could not send your message. Please try again.",
        );
      setSuccess(
        body.message ||
          "Thanks for reaching out. Your message has been received.",
      );
      form.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not reach the contact service. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="contact-page">
      <div className="contact-page-inner">
        <header className="contact-page-heading">
          <p className="contact-eyebrow">ALL HOURS CAFE</p>
          <h1>Contact Us</h1>
          <p>Have a question or feedback? We’d love to hear from you.</p>
        </header>
        <div className="contact-page-content">
          <section
            className="contact-info-panel"
            aria-labelledby="contact-get-in-touch"
          >
            <h2 id="contact-get-in-touch">Get in Touch</h2>
            <p className="contact-intro">
              Whether you have a question about our menu, want to make a
              reservation, or just want to say hello, feel free to reach out.
            </p>
            <div className="contact-detail-list">
              <div className="contact-detail">
                <i className="fas fa-map-marker-alt" aria-hidden="true" />
                <div>
                  <h3>Location</h3>
                  <p>
                    123 Cafe Street
                    <br />
                    Foodie District
                    <br />
                    Your City, ST 12345
                  </p>
                </div>
              </div>
              <div className="contact-detail">
                <i className="fas fa-phone" aria-hidden="true" />
                <div>
                  <h3>Phone</h3>
                  <p>
                    <a href="tel:+11234567890">(123) 456-7890</a>
                  </p>
                </div>
              </div>
              <div className="contact-detail">
                <i className="fas fa-envelope" aria-hidden="true" />
                <div>
                  <h3>Email</h3>
                  <p>
                    <a href="mailto:info@allhourscafe.com">
                      info@allhourscafe.com
                    </a>
                  </p>
                </div>
              </div>
              <div className="contact-detail">
                <i className="fas fa-clock" aria-hidden="true" />
                <div>
                  <h3>Hours</h3>
                  <p>
                    Open 24/7
                    <br />
                    365 days a year
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section
            className="contact-form-panel"
            aria-labelledby="contact-send-message"
          >
            <h2 id="contact-send-message">Send us a Message</h2>
            {success && (
              <div className="contact-alert success" role="status">
                {success}
              </div>
            )}
            {error && (
              <div className="contact-alert error" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={submit}>
              <label>
                Name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                />
              </label>
              <label>
                Subject
                <input name="subject" required maxLength={200} />
              </label>
              <label>
                Message
                <textarea name="message" rows={6} required maxLength={2000} />
              </label>
              <button
                className="contact-submit"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
