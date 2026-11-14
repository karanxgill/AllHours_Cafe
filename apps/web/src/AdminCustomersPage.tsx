import { useEffect, useMemo, useState } from "react";

type Customer = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  createdAt: string;
  orderCount?: number;
  lifetimeSpend?: number;
  latestOrderAt?: string | null;
  activeOrders?: number;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  orders?: Array<{
    id: number;
    orderDate: string;
    total: number;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    items: Array<{ name: string; quantity: number; total: number }>;
  }>;
};
type Body = { customers?: Customer[]; customer?: Customer; error?: { message?: string } };
const money = (amount: number) => `₹${amount.toFixed(2)}`;

export function AdminCustomersPage({ path }: { path: string }) {
  const detailId = path.match(/^\/admin\/customers\/(\d+)$/)?.[1];
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const endpoint = detailId ? `/api/v1/admin/customers/${detailId}` : "/api/v1/admin/customers";
    fetch(endpoint, { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as Body;
        if (!response.ok) throw new Error(body.error?.message || (response.status === 401 ? "Sign in with an administrator account." : "Customer data is unavailable."));
        setCustomers(body.customers || []);
        setCustomer(body.customer || null);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Customer data is unavailable."))
      .finally(() => setLoading(false));
  }, [detailId]);

  const visibleCustomers = useMemo(() => customers.filter((entry) => `${entry.fullName} ${entry.email} ${entry.phoneNumber || ""}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);

  return (
    <section className="admin-page">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <a className="admin-brand" href="/admin"><span className="admin-brand-mark">AH</span><span><strong>All Hours</strong><small>Cafe management</small></span></a>
          <div className="admin-nav-label">WORKSPACE</div>
          <nav aria-label="Admin navigation">
            <a href="/admin"><span className="admin-nav-dot" />Overview</a>
            <a href="/admin/menu-items"><span className="admin-nav-dot" />Menu items</a>
            <a href="/admin/categories"><span className="admin-nav-dot" />Categories</a>
            <a href="/admin/orders"><span className="admin-nav-dot" />Orders</a>
            <a className="selected" href="/admin/customers"><span className="admin-nav-dot" />Customers</a>
          </nav>
          <div className="admin-sidebar-bottom"><span className="admin-sidebar-caption">STAFF CONSOLE</span><a className="admin-back" href="/">← <span>View cafe website</span></a></div>
        </aside>
        <div className="admin-content">
          <div className="admin-topbar"><div><span className="admin-live-dot" />Administration <span className="admin-topbar-divider">/</span> All Hours Cafe</div><a href="/">View storefront <span aria-hidden="true">↗</span></a></div>
          <main className="admin-main">
            <div className="admin-heading"><div><p className="admin-eyebrow">CUSTOMER RELATIONSHIPS</p><h2>{detailId ? customer?.fullName || "Customer details" : "Customers"}</h2><p>{detailId ? "Profile, order history, and recorded payment status." : "Customer contact details and order activity in one place."}</p></div>{detailId && <a className="admin-secondary" href="/admin/customers">← All customers</a>}</div>
            {error && <div className="admin-alert error" role="alert">{error}{error.toLowerCase().includes("sign in") && <> <a href={`/login?returnUrl=${encodeURIComponent(path)}`}>Sign in</a></>}</div>}
            {loading && <div className="admin-loading" role="status"><span className="admin-spinner" />Loading customer records…</div>}
            {!loading && !error && !detailId && <section className="admin-card admin-table-wrap">
              <div className="admin-card-title-row"><div><h3>Customer directory</h3><p className="admin-muted">{visibleCustomers.length} of {customers.length} customers</p></div><label className="admin-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search customers" placeholder="Search name, email, or phone" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
              {visibleCustomers.length ? <table className="admin-table"><thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th>Orders</th><th>In progress</th><th>Lifetime spend</th><th>Last order</th><th /></tr></thead><tbody>{visibleCustomers.map((entry) => <tr key={entry.id}><td><strong>{entry.fullName}</strong><small>{entry.email}</small></td><td>{entry.phoneNumber || "Not provided"}</td><td>{new Date(entry.createdAt).toLocaleDateString()}</td><td>{entry.orderCount}</td><td>{entry.activeOrders}</td><td>{money(entry.lifetimeSpend || 0)}</td><td>{entry.latestOrderAt ? new Date(entry.latestOrderAt).toLocaleDateString() : "—"}</td><td><a className="admin-text-button" href={`/admin/customers/${entry.id}`}>View</a></td></tr>)}</tbody></table> : <p className="admin-muted">No customers match this search.</p>}
            </section>}
            {!loading && !error && detailId && customer && <>
              <div className="admin-metrics"><article className="admin-metric"><span>Orders</span><strong>{customer.orders?.length || 0}</strong></article><article className="admin-metric"><span>Recorded spend</span><strong>{money((customer.orders || []).reduce((sum, order) => sum + order.total, 0))}</strong></article><article className="admin-metric"><span>Customer since</span><strong>{new Date(customer.createdAt).toLocaleDateString()}</strong></article></div>
              <section className="admin-card"><div className="admin-card-title-row"><h3>Customer profile</h3><a href={`mailto:${customer.email}`}>Email customer ↗</a></div><div className="admin-order-details"><div><h4>Name</h4><p>{customer.fullName}</p></div><div><h4>Email</h4><p><a href={`mailto:${customer.email}`}>{customer.email}</a></p></div><div><h4>Phone</h4><p>{customer.phoneNumber ? <a href={`tel:${customer.phoneNumber}`}>{customer.phoneNumber}</a> : "Not provided"}</p></div>{customer.address && <div><h4>Saved address</h4><p>{customer.address}<br />{[customer.city, customer.state, customer.postalCode].filter(Boolean).join(", ")}</p></div>}</div></section>
              <section className="admin-card admin-table-wrap"><h3>Orders and payment records</h3>{customer.orders?.length ? <table className="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Payment method</th><th>Payment status</th><th>Order status</th></tr></thead><tbody>{customer.orders.map((order) => <tr key={order.id}><td><a className="admin-text-button" href={`/admin/orders/${order.id}`}>AHC-{String(order.id).padStart(6, "0")}</a></td><td>{new Date(order.orderDate).toLocaleString()}</td><td>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</td><td>{money(order.total)}</td><td>{order.paymentMethod}</td><td><span className="admin-status">{order.paymentStatus}</span></td><td><span className={`admin-status ${["Completed", "Delivered"].includes(order.orderStatus) ? "active" : ""}`}>{order.orderStatus}</span></td></tr>)}</tbody></table> : <p className="admin-muted">This customer has not placed an order yet.</p>}<p className="account-payment-note">Payments are collected at the cafe in the current release. These are the order payment methods and statuses recorded by the system.</p></section>
            </>}
          </main>
        </div>
      </div>
    </section>
  );
}
