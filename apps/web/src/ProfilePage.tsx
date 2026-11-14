import { FormEvent, useEffect, useState } from "react";

type Profile = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  createdAt: string;
};
type AccountOrder = {
  id: number;
  orderDate: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  items: Array<{ name: string; quantity: number; total: number }>;
};
type AccountResponse = {
  profile?: Profile;
  orders?: AccountOrder[];
  error?: { message?: string };
};

const money = (amount: number) => `₹${amount.toFixed(2)}`;

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/v1/auth/profile", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as AccountResponse;
        if (!response.ok) throw new Error(body.error?.message || "Sign in to view your account.");
        setProfile(body.profile || null);
        setOrders(body.orders || []);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Account details are unavailable."))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    setNotice("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: data.get("fullName"), phoneNumber: data.get("phoneNumber") }),
      });
      const body = (await response.json()) as AccountResponse;
      if (!response.ok || !body.profile) throw new Error(body.error?.message || "Profile could not be saved.");
      setProfile(body.profile);
      setNotice("Your profile has been saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="account-page"><div className="account-shell"><p>Loading your account…</p></div></section>;
  if (!profile) return <section className="account-page"><div className="account-shell"><h1>Sign in to your account</h1><p>{error}</p><a className="order-primary-link" href="/login?returnUrl=%2Fprofile">Sign in</a></div></section>;

  const lifetimeSpend = orders.reduce((total, order) => total + order.total, 0);
  const inProgress = orders.filter((order) => !["Completed", "Delivered", "Cancelled"].includes(order.orderStatus));

  return (
    <section className="account-page">
      <div className="account-shell">
        <div className="account-heading">
          <div><p className="eyebrow">YOUR ACCOUNT</p><h1>Customer profile</h1><p>Manage your details and keep up with every order.</p></div>
          <a className="account-back-link" href="/menu">Browse menu <span aria-hidden="true">↗</span></a>
        </div>
        {error && <div className="order-error" role="alert">{error}</div>}
        {notice && <div className="account-notice" role="status">{notice}</div>}
        <div className="account-metrics">
          <article><span>Total orders</span><strong>{orders.length}</strong></article>
          <article><span>In progress</span><strong>{inProgress.length}</strong></article>
          <article><span>Recorded order spend</span><strong>{money(lifetimeSpend)}</strong></article>
        </div>
        <div className="account-columns">
          <section className="account-card">
            <div className="account-card-heading"><div><p className="eyebrow">PERSONAL DETAILS</p><h2>Your profile</h2></div></div>
            <form className="account-form" onSubmit={saveProfile}>
              <label>Full name<input name="fullName" autoComplete="name" defaultValue={profile.fullName} required maxLength={100} /></label>
              <label>Email address<input value={profile.email} readOnly /></label>
              <label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel" defaultValue={profile.phoneNumber || ""} maxLength={50} placeholder="Add a phone number for checkout" /></label>
              <button className="order-primary-link" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
            </form>
            <p className="account-footnote">Member since {new Date(profile.createdAt).toLocaleDateString()}</p>
          </section>
          <section className="account-card account-orders-card">
            <div className="account-card-heading"><div><p className="eyebrow">ORDER ACTIVITY</p><h2>Order history</h2></div></div>
            {orders.length ? <div className="account-order-list">{orders.map((order) => (
              <article className="account-order" key={order.id}>
                <div className="account-order-top"><div><strong>AHC-{String(order.id).padStart(6, "0")}</strong><span>{new Date(order.orderDate).toLocaleString()}</span></div><strong>{money(order.total)}</strong></div>
                <p>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(" · ")}</p>
                <div className="account-order-bottom"><span className="account-status">{order.orderStatus}</span><span>{order.paymentMethod} · {order.paymentStatus}</span><a href={`/orders/${order.id}`}>Details</a></div>
              </article>
            ))}</div> : <div className="account-empty"><h3>No orders yet</h3><p>Your placed orders and their status will appear here.</p><a href="/menu">Explore the menu</a></div>}
          </section>
        </div>
        <p className="account-payment-note">Payments are currently collected at the cafe. Payment history here reflects the method and status recorded for each order.</p>
      </div>
    </section>
  );
}
