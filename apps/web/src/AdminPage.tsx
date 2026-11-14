import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api.js";

type Category = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  _count?: { menuItems: number };
};
type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isActive: boolean;
  categoryId: number;
  category: { name: string };
  spicyLevel: string | null;
  prepTimeMinutes: number | null;
  calories: number | null;
};
type AdminOrder = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderType: string;
  orderDate: string;
  itemCount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
};
type OrderDetail = AdminOrder & {
  deliveryAddress: string;
  city: string;
  state: string;
  postalCode: string;
  specialInstructions: string | null;
  deliveryTime: string | null;
  subTotal: number;
  deliveryFee: number;
  tax: number;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
};
type AdminData = {
  metrics: {
    menuItems: number;
    categories: number;
    reservations: number;
    unreadContacts: number;
    orders: number;
  };
  recentReservations: Array<{
    id: number;
    name: string;
    reservationDate: string;
    numberOfGuests: number;
    isConfirmed: boolean;
  }>;
  recentContacts: Array<{
    id: number;
    name: string;
    subject: string;
    createdAt: string;
    isRead: boolean;
  }>;
};
type ApiBody = {
  error?: { message?: string };
  metrics?: AdminData["metrics"];
  recentReservations?: AdminData["recentReservations"];
  recentContacts?: AdminData["recentContacts"];
  categories?: Category[];
  items?: MenuItem[];
  orders?: AdminOrder[];
  order?: OrderDetail & { orderStatus: string };
};
const api = "/api/v1/admin";
class AdminRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Ready",
  "Delivered",
  "Completed",
  "Cancelled",
];

async function request<T extends ApiBody>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(`${api}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T;
  if (!response.ok)
    throw new AdminRequestError(
      body.error?.message || "The request could not be completed.",
      response.status,
    );
  return body;
}

export function AdminPage({ path }: { path: string }) {
  const [dashboard, setDashboard] = useState<AdminData | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [itemStatusFilter, setItemStatusFilter] = useState("All");
  const [itemCategoryFilter, setItemCategoryFilter] = useState("All");
  const [itemSearch, setItemSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const section = path.startsWith("/admin/menu-items")
    ? "menu"
    : path.startsWith("/admin/categories")
      ? "categories"
      : path.startsWith("/admin/orders")
        ? "orders"
        : "dashboard";
  const orderDetailId = path.match(/^\/admin\/orders\/(\d+)$/)?.[1];

  const load = useCallback(async () => {
    setError("");
    setLoadingData(true);
    try {
      if (section === "dashboard") {
        const result = await request<AdminData & ApiBody>("/dashboard");
        setDashboard({
          metrics: result.metrics!,
          recentReservations: result.recentReservations!,
          recentContacts: result.recentContacts!,
        });
      } else if (section === "menu") {
        const result = await request<ApiBody>("/menu-items");
        setItems(result.items || []);
        setCategories(result.categories || []);
      } else if (section === "orders") {
        if (orderDetailId) {
          const result = await request<ApiBody>(`/orders/${orderDetailId}`);
          setOrder(
            result.order
              ? {
                  ...result.order,
                  itemCount: result.order.items.reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                  ),
                }
              : null,
          );
          if (result.order) setOrderStatus(result.order.orderStatus);
        } else {
          const result = await request<ApiBody>("/orders");
          setOrders(result.orders || []);
        }
      } else {
        const result = await request<ApiBody>("/categories");
        setCategories(result.categories || []);
      }
    } catch (cause) {
      setAccessDenied(
        cause instanceof AdminRequestError &&
          (cause.status === 401 || cause.status === 403),
      );
      setError(
        cause instanceof Error
          ? cause.message
          : "The admin area could not be loaded.",
      );
    } finally {
      setLoadingData(false);
    }
  }, [section, orderDetailId]);

  async function updateOrderStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ orderStatus }),
      });
      setNotice(
        `Order AHC-${String(order.id).padStart(6, "0")} updated to ${orderStatus}.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The order status could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!formOpen) return;
    window.requestAnimationFrame(() =>
      document
        .querySelector<HTMLFormElement>("#admin-edit-form")
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }, [formOpen]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const editingId = form.get("id");
    const categoryData = {
      name: String(form.get("name") || ""),
      description: String(form.get("description") || "") || null,
      imageUrl: String(form.get("imageUrl") || "") || null,
      isActive: form.get("isActive") === "on",
    };
    const itemData = {
      ...categoryData,
      categoryId: Number(form.get("categoryId")),
      price: Number(form.get("price")),
      isVegetarian: form.get("isVegetarian") === "on",
      isVegan: form.get("isVegan") === "on",
      isGlutenFree: form.get("isGlutenFree") === "on",
      spicyLevel: String(form.get("spicyLevel") || "") || null,
      prepTimeMinutes: form.get("prepTimeMinutes")
        ? Number(form.get("prepTimeMinutes"))
        : null,
      calories: form.get("calories") ? Number(form.get("calories")) : null,
    };
    try {
      const endpoint = section === "menu" ? "/menu-items" : "/categories";
      await request(endpoint + (editingId ? `/${editingId}` : ""), {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(section === "menu" ? itemData : categoryData),
      });
      setNotice(editingId ? "Changes saved." : "Created successfully.");
      formElement.reset();
      setFormOpen(false);
      setEditing(false);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Changes could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openNewForm() {
    document.querySelector<HTMLFormElement>("#admin-edit-form")?.reset();
    setEditing(false);
    setFormOpen(true);
  }

  function editCategory(category: Category) {
    const form = document.querySelector<HTMLFormElement>("#admin-edit-form");
    if (!form) return;
    (form.elements.namedItem("id") as HTMLInputElement).value = String(
      category.id,
    );
    (form.elements.namedItem("name") as HTMLInputElement).value = category.name;
    (form.elements.namedItem("description") as HTMLInputElement).value =
      category.description || "";
    (form.elements.namedItem("imageUrl") as HTMLInputElement).value =
      category.imageUrl || "";
    (form.elements.namedItem("isActive") as HTMLInputElement).checked =
      category.isActive;
    setEditing(true);
    setFormOpen(true);
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function editItem(item: MenuItem) {
    const form = document.querySelector<HTMLFormElement>("#admin-edit-form");
    if (!form) return;
    const set = (name: string, value: string | number | null | boolean) => {
      const input = form.elements.namedItem(name) as
        HTMLInputElement | HTMLSelectElement | null;
      if (input)
        input instanceof HTMLInputElement && input.type === "checkbox"
          ? (input.checked = Boolean(value))
          : (input.value = value == null ? "" : String(value));
    };
    set("id", item.id);
    set("name", item.name);
    set("description", item.description);
    set("imageUrl", item.imageUrl);
    set("isActive", item.isActive);
    set("categoryId", item.categoryId);
    set("price", item.price);
    set("isVegetarian", item.isVegetarian);
    set("isVegan", item.isVegan);
    set("isGlutenFree", item.isGlutenFree);
    set("spicyLevel", item.spicyLevel);
    set("prepTimeMinutes", item.prepTimeMinutes);
    set("calories", item.calories);
    setEditing(true);
    setFormOpen(true);
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const visibleItems = items.filter((item) => {
    const matchesSearch =
      `${item.name} ${item.description || ""} ${item.category.name}`
        .toLowerCase()
        .includes(itemSearch.trim().toLowerCase());
    return (
      matchesSearch &&
      (itemCategoryFilter === "All" ||
        item.categoryId === Number(itemCategoryFilter)) &&
      (itemStatusFilter === "All" ||
        (itemStatusFilter === "Active" ? item.isActive : !item.isActive))
    );
  });

  const title =
    section === "menu"
      ? "Menu items"
      : section === "categories"
        ? "Categories"
        : section === "orders"
          ? orderDetailId
            ? "Order details"
            : "Orders"
          : "Overview";
  return (
    <section className="admin-page">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <a className="admin-brand" href="/admin">
            <span className="admin-brand-mark">AH</span>
            <span>
              <strong>All Hours</strong>
              <small>Cafe management</small>
            </span>
          </a>
          <div className="admin-nav-label">WORKSPACE</div>
          <nav aria-label="Admin navigation">
            <a
              className={section === "dashboard" ? "selected" : ""}
              href="/admin"
            >
              <span className="admin-nav-dot" />
              Overview
            </a>
            <a
              className={section === "menu" ? "selected" : ""}
              href="/admin/menu-items"
            >
              <span className="admin-nav-dot" />
              Menu items
            </a>
            <a
              className={section === "categories" ? "selected" : ""}
              href="/admin/categories"
            >
              <span className="admin-nav-dot" />
              Categories
            </a>
            <a
              className={section === "orders" ? "selected" : ""}
              href="/admin/orders"
            >
              <span className="admin-nav-dot" />
              Orders
            </a>
          </nav>
          <div className="admin-sidebar-bottom">
            <span className="admin-sidebar-caption">STAFF CONSOLE</span>
            <a className="admin-back" href="/">
              ← <span>View cafe website</span>
            </a>
          </div>
        </aside>
        <div className="admin-content">
          <div className="admin-topbar">
            <div>
              <span className="admin-live-dot" />
              Administration <span className="admin-topbar-divider">/</span> All
              Hours Cafe
            </div>
            <a href="/">
              View storefront <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div
            className="admin-main"
            role="region"
            aria-label={`${title} workspace`}
          >
            <div className="admin-heading">
              <div>
                <p className="admin-eyebrow">
                  {section === "orders"
                    ? "ORDER MANAGEMENT"
                    : section === "menu" || section === "categories"
                      ? "CATALOG MANAGEMENT"
                      : "BUSINESS OVERVIEW"}
                </p>
                <h2>{title}</h2>
                <p>
                  {section === "orders"
                    ? "Review customer orders and keep fulfillment moving."
                    : section === "menu"
                      ? "Keep your customer-facing menu up to date."
                      : section === "categories"
                        ? "Organize menu items into clear customer categories."
                        : "A quick view of cafe operations and catalog activity."}
                </p>
              </div>
              {section === "menu" && (
                <button
                  className="admin-primary"
                  type="button"
                  onClick={openNewForm}
                >
                  <span aria-hidden="true">＋</span> Add menu item
                </button>
              )}
              {section === "categories" && (
                <button
                  className="admin-primary"
                  type="button"
                  onClick={openNewForm}
                >
                  <span aria-hidden="true">＋</span> Add category
                </button>
              )}
              {section === "orders" && orderDetailId && (
                <a className="admin-secondary" href="/admin/orders">
                  ← All orders
                </a>
              )}
            </div>
            {error && (
              <div className="admin-alert error" role="alert">
                {error}
                {accessDenied && error.includes("Sign in") ? (
                  <>
                    {" "}
                    <a href={`/login?returnUrl=${encodeURIComponent(path)}`}>
                      Sign in
                    </a>
                  </>
                ) : null}
              </div>
            )}
            {notice && (
              <div className="admin-alert success" role="status">
                {notice}
              </div>
            )}
            {!accessDenied && loadingData && (
              <div className="admin-loading" role="status">
                <span className="admin-spinner" />
                Loading workspace data…
              </div>
            )}
            {!accessDenied && section === "dashboard" && dashboard && (
              <>
                <div className="admin-metrics">
                  {[
                    [
                      "Menu items",
                      dashboard.metrics.menuItems,
                      "/admin/menu-items",
                    ],
                    [
                      "Categories",
                      dashboard.metrics.categories,
                      "/admin/categories",
                    ],
                    ["Reservations", dashboard.metrics.reservations, "#"],
                    ["Orders", dashboard.metrics.orders, "/admin/orders"],
                    ["Unread messages", dashboard.metrics.unreadContacts, "#"],
                  ].map(([label, value, href]) => (
                    <a
                      className="admin-metric"
                      href={String(href)}
                      key={String(label)}
                    >
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </a>
                  ))}
                </div>
                <div className="admin-columns">
                  <section className="admin-card">
                    <h3>Recent reservations</h3>
                    {dashboard.recentReservations.length ? (
                      dashboard.recentReservations.map((r) => (
                        <div className="admin-list-row" key={r.id}>
                          <strong>{r.name}</strong>
                          <span>
                            {new Date(r.reservationDate).toLocaleString()} ·{" "}
                            {r.numberOfGuests} guests
                          </span>
                          <small>
                            {r.isConfirmed ? "Confirmed" : "Pending"}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="admin-muted">No reservations yet.</p>
                    )}
                  </section>
                  <section className="admin-card">
                    <h3>Recent messages</h3>
                    {dashboard.recentContacts.length ? (
                      dashboard.recentContacts.map((c) => (
                        <div className="admin-list-row" key={c.id}>
                          <strong>{c.subject}</strong>
                          <span>
                            {c.name} ·{" "}
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                          <small>{c.isRead ? "Read" : "Unread"}</small>
                        </div>
                      ))
                    ) : (
                      <p className="admin-muted">No contact messages yet.</p>
                    )}
                  </section>
                </div>
              </>
            )}
            {!accessDenied && section === "orders" && !orderDetailId && (
              <section className="admin-card admin-table-wrap">
                <div className="admin-card-title-row">
                  <h3>All orders</h3>
                  <label className="admin-filter">
                    Status{" "}
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option>All</option>
                      {ORDER_STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {orders.length ? (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders
                        .filter(
                          (item) =>
                            statusFilter === "All" ||
                            item.orderStatus === statusFilter,
                        )
                        .map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>
                                AHC-{String(item.id).padStart(6, "0")}
                              </strong>
                            </td>
                            <td>
                              <strong>{item.customerName}</strong>
                              <small>{item.customerEmail}</small>
                            </td>
                            <td>{new Date(item.orderDate).toLocaleString()}</td>
                            <td>{item.itemCount}</td>
                            <td>₹{item.total.toFixed(2)}</td>
                            <td>
                              <span className="admin-status">
                                {item.paymentStatus}
                              </span>
                              <small>{item.paymentMethod}</small>
                            </td>
                            <td>
                              <span
                                className={`admin-status ${item.orderStatus === "Completed" || item.orderStatus === "Delivered" ? "active" : ""}`}
                              >
                                {item.orderStatus}
                              </span>
                            </td>
                            <td>
                              <a
                                className="admin-text-button"
                                href={`/admin/orders/${item.id}`}
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="admin-muted">No orders have been placed yet.</p>
                )}
              </section>
            )}
            {!accessDenied &&
              section === "orders" &&
              orderDetailId &&
              order && (
                <>
                  <section className="admin-card">
                    <div className="admin-card-title-row">
                      <h3>Order AHC-{String(order.id).padStart(6, "0")}</h3>
                      <span className="admin-status">
                        {order.paymentStatus} · {order.paymentMethod}
                      </span>
                    </div>
                    <div className="admin-order-details">
                      <div>
                        <h4>Customer</h4>
                        <p>
                          <strong>{order.customerName}</strong>
                          <br />
                          <a href={`mailto:${order.customerEmail}`}>
                            {order.customerEmail}
                          </a>
                          <br />
                          <a href={`tel:${order.customerPhone}`}>
                            {order.customerPhone}
                          </a>
                        </p>
                      </div>
                      <div>
                        <h4>
                          {order.orderType === "Pickup" ? "Pickup" : "Delivery"}
                        </h4>
                        {order.orderType === "Pickup" ? (
                          <p>
                            Collect at All Hours Cafe
                            {order.deliveryTime && (
                              <>
                                <br />
                                Requested:{" "}
                                {new Date(order.deliveryTime).toLocaleString()}
                              </>
                            )}
                          </p>
                        ) : (
                          <p>
                            {order.deliveryAddress}
                            <br />
                            {order.city}, {order.state} {order.postalCode}
                            {order.deliveryTime && (
                              <>
                                <br />
                                Requested:{" "}
                                {new Date(order.deliveryTime).toLocaleString()}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <h4>Order time</h4>
                        <p>{new Date(order.orderDate).toLocaleString()}</p>
                      </div>
                      {order.specialInstructions && (
                        <div>
                          <h4>Special instructions</h4>
                          <p>{order.specialInstructions}</p>
                        </div>
                      )}
                    </div>
                    <form
                      className="admin-status-form"
                      onSubmit={updateOrderStatus}
                    >
                      <label>
                        Order status
                        <select
                          value={orderStatus}
                          onChange={(event) =>
                            setOrderStatus(event.target.value)
                          }
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="admin-primary"
                        disabled={busy || orderStatus === order.orderStatus}
                      >
                        {busy ? "Saving…" : "Update status"}
                      </button>
                    </form>
                  </section>
                  <section className="admin-card admin-table-wrap">
                    <h3>Items and totals</h3>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Price</th>
                          <th>Qty</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>₹{item.price.toFixed(2)}</td>
                            <td>{item.quantity}</td>
                            <td>₹{item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>Subtotal</td>
                          <td>₹{order.subTotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3}>Tax</td>
                          <td>₹{order.tax.toFixed(2)}</td>
                        </tr>
                        {order.deliveryFee > 0 && (
                          <tr>
                            <td colSpan={3}>Delivery fee</td>
                            <td>₹{order.deliveryFee.toFixed(2)}</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={3}>
                            <strong>Total</strong>
                          </td>
                          <td>
                            <strong>₹{order.total.toFixed(2)}</strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                </>
              )}
            {!accessDenied && section === "menu" && (
              <>
                <section className="admin-card admin-table-wrap admin-catalog-panel">
                  <div className="admin-catalog-toolbar">
                    <div>
                      <h3>Menu catalog</h3>
                      <p>
                        {visibleItems.length} of {items.length}{" "}
                        {items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="admin-catalog-filters">
                      <label className="admin-search">
                        <span aria-hidden="true">⌕</span>
                        <input
                          aria-label="Search menu items"
                          type="search"
                          placeholder="Search menu"
                          value={itemSearch}
                          onChange={(event) =>
                            setItemSearch(event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-filter">
                        <span className="admin-filter-caption">Category</span>
                        <select
                          value={itemCategoryFilter}
                          onChange={(event) =>
                            setItemCategoryFilter(event.target.value)
                          }
                        >
                          <option value="All">All categories</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-filter">
                        <span className="admin-filter-caption">Visibility</span>
                        <select
                          value={itemStatusFilter}
                          onChange={(event) =>
                            setItemStatusFilter(event.target.value)
                          }
                        >
                          <option>All</option>
                          <option>Active</option>
                          <option>Hidden</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  {loadingData ? null : visibleItems.length ? (
                    <table className="admin-table admin-menu-table">
                      <thead>
                        <tr>
                          <th>Menu item</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th>Visibility</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div className="admin-menu-item-cell">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="admin-menu-thumb">
                                    {item.name.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <span>
                                  <strong>{item.name}</strong>
                                  <small>
                                    {item.description || "No description"}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>{item.category.name}</td>
                            <td>
                              <strong>₹{item.price.toFixed(2)}</strong>
                            </td>
                            <td>
                              <span
                                className={`admin-status ${item.isActive ? "active" : ""}`}
                              >
                                <i /> {item.isActive ? "Visible" : "Hidden"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="admin-text-button"
                                type="button"
                                onClick={() => editItem(item)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="admin-empty-state">
                      <span className="admin-empty-icon">☷</span>
                      <strong>
                        {items.length
                          ? "No matching menu items"
                          : "Your menu is ready to build"}
                      </strong>
                      <p>
                        {items.length
                          ? "Try a different search or adjust the filters."
                          : "Add your first menu item to make it available on the customer menu."}
                      </p>
                      {!items.length && (
                        <button
                          className="admin-primary"
                          type="button"
                          onClick={openNewForm}
                        >
                          ＋ Add menu item
                        </button>
                      )}
                    </div>
                  )}
                </section>
                <form
                  id="admin-edit-form"
                  hidden={!formOpen}
                  className="admin-card admin-form admin-edit-panel"
                  onSubmit={save}
                >
                  <div className="admin-edit-heading">
                    <div>
                      <p className="admin-eyebrow">MENU CATALOG</p>
                      <h3>{editing ? "Edit menu item" : "Add menu item"}</h3>
                      <p>Set the details customers will see on the menu.</p>
                    </div>
                    <button
                      className="admin-close-button"
                      type="button"
                      aria-label="Close form"
                      onClick={() => {
                        setFormOpen(false);
                        setEditing(false);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <input type="hidden" name="id" />
                  <div className="admin-form-grid">
                    <label>
                      Item name
                      <input
                        name="name"
                        required
                        maxLength={100}
                        placeholder="e.g. Avocado toast"
                      />
                    </label>
                    <label>
                      Category
                      <select name="categoryId" required defaultValue="">
                        <option value="" disabled>
                          Choose a category
                        </option>
                        {categories
                          .filter((c) => c.isActive)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Price (₹)
                      <input
                        name="price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        placeholder="0.00"
                      />
                    </label>
                    <label>
                      Image URL
                      <input
                        name="imageUrl"
                        type="url"
                        placeholder="https://…"
                      />
                    </label>
                    <label className="admin-wide">
                      Description
                      <textarea
                        name="description"
                        rows={3}
                        maxLength={500}
                        placeholder="Describe the item for customers"
                      />
                    </label>
                    <label>
                      Spice level
                      <input
                        name="spicyLevel"
                        maxLength={50}
                        placeholder="Optional"
                      />
                    </label>
                    <label>
                      Prep time (minutes)
                      <input
                        name="prepTimeMinutes"
                        type="number"
                        min="1"
                        placeholder="Optional"
                      />
                    </label>
                    <label>
                      Calories
                      <input
                        name="calories"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Optional"
                      />
                    </label>
                  </div>
                  <div className="admin-checks">
                    <label>
                      <input type="checkbox" name="isVegetarian" /> Vegetarian
                    </label>
                    <label>
                      <input type="checkbox" name="isVegan" /> Vegan
                    </label>
                    <label>
                      <input type="checkbox" name="isGlutenFree" /> Gluten-free
                    </label>
                    <label>
                      <input type="checkbox" name="isActive" defaultChecked />{" "}
                      Visible on customer menu
                    </label>
                  </div>
                  <div className="admin-form-actions">
                    <button
                      className="admin-secondary"
                      type="button"
                      onClick={() => {
                        setFormOpen(false);
                        setEditing(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button className="admin-primary" disabled={busy}>
                      {busy
                        ? "Saving…"
                        : editing
                          ? "Save changes"
                          : "Add menu item"}
                    </button>
                  </div>
                </form>
              </>
            )}
            {!accessDenied && section === "categories" && (
              <>
                {!loadingData &&
                  (categories.length ? (
                    <section className="admin-category-grid">
                      {categories.map((category) => (
                        <article
                          className="admin-category-card"
                          key={category.id}
                        >
                          <div className="admin-category-card-top">
                            {category.imageUrl ? (
                              <img
                                src={category.imageUrl}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span className="admin-category-mark">
                                {category.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span
                              className={`admin-status ${category.isActive ? "active" : ""}`}
                            >
                              <i />
                              {category.isActive ? "Active" : "Hidden"}
                            </span>
                          </div>
                          <div className="admin-category-card-body">
                            <div className="admin-category-title-row">
                              <h3>{category.name}</h3>
                              <button
                                className="admin-text-button"
                                type="button"
                                onClick={() => editCategory(category)}
                              >
                                Edit
                              </button>
                            </div>
                            <p>
                              {category.description || "No description added."}
                            </p>
                            <div className="admin-category-meta">
                              <strong>{category._count?.menuItems ?? 0}</strong>
                              <span>
                                {category._count?.menuItems === 1
                                  ? "menu item"
                                  : "menu items"}
                              </span>
                              <span className="admin-meta-divider" />
                              <span>
                                {category.isActive
                                  ? "Shown on menu"
                                  : "Hidden from menu"}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </section>
                  ) : (
                    <section className="admin-card admin-empty-state">
                      <span className="admin-empty-icon">▦</span>
                      <strong>No categories yet</strong>
                      <p>
                        Create a category first, then assign menu items to it.
                      </p>
                      <button
                        className="admin-primary"
                        type="button"
                        onClick={openNewForm}
                      >
                        ＋ Add category
                      </button>
                    </section>
                  ))}
                <form
                  id="admin-edit-form"
                  hidden={!formOpen}
                  className="admin-card admin-form admin-edit-panel"
                  onSubmit={save}
                >
                  <div className="admin-edit-heading">
                    <div>
                      <p className="admin-eyebrow">MENU ORGANIZATION</p>
                      <h3>{editing ? "Edit category" : "Add category"}</h3>
                      <p>Categories help customers find items on your menu.</p>
                    </div>
                    <button
                      className="admin-close-button"
                      type="button"
                      aria-label="Close form"
                      onClick={() => {
                        setFormOpen(false);
                        setEditing(false);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <input type="hidden" name="id" />
                  <div className="admin-form-grid">
                    <label>
                      Category name
                      <input
                        name="name"
                        required
                        maxLength={100}
                        placeholder="e.g. Breakfast"
                      />
                    </label>
                    <label>
                      Image URL
                      <input
                        name="imageUrl"
                        type="url"
                        placeholder="https://…"
                      />
                    </label>
                    <label className="admin-wide">
                      Description
                      <textarea
                        name="description"
                        rows={3}
                        maxLength={500}
                        placeholder="A short description of this menu category"
                      />
                    </label>
                  </div>
                  <label className="admin-inline-check">
                    <input type="checkbox" name="isActive" defaultChecked />{" "}
                    Active and visible to customers
                  </label>
                  <div className="admin-form-actions">
                    <button
                      className="admin-secondary"
                      type="button"
                      onClick={() => {
                        setFormOpen(false);
                        setEditing(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button className="admin-primary" disabled={busy}>
                      {busy
                        ? "Saving…"
                        : editing
                          ? "Save changes"
                          : "Add category"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
