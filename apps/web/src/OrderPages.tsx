import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api.js";

type CartLine = {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
};
type User = { id: number; fullName: string; email: string; role: string };
type Order = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderType: string;
  deliveryAddress: string;
  city: string;
  state: string;
  postalCode: string;
  specialInstructions: string | null;
  deliveryTime: string | null;
  orderDate: string;
  subTotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  items: Array<{
    menuItemId: number;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
};
type ApiError = {
  error?: { message?: string; fields?: Record<string, string[]> };
};
const CART_KEY = "all-hours-cafe-cart";

function readCart(): CartLine[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(CART_KEY) || "[]",
    ) as CartLine[];
    return Array.isArray(value)
      ? value.filter(
          (line) =>
            Number.isInteger(line.id) &&
            Number.isFinite(line.price) &&
            Number.isInteger(line.quantity) &&
            line.quantity > 0,
        )
      : [];
  } catch {
    return [];
  }
}

function storeCart(lines: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("cafe-cart-updated"));
}

const money = (amount: number) => `₹${amount.toFixed(2)}`;

export function CartPage() {
  const [items, setItems] = useState<CartLine[]>([]);
  useEffect(() => setItems(readCart()), []);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  function update(id: number, quantity: number) {
    const updated =
      quantity < 1
        ? items.filter((item) => item.id !== id)
        : items.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.min(quantity, 99) }
              : item,
          );
    setItems(updated);
    storeCart(updated);
  }

  return (
    <section className="order-page">
      <div className="order-page-inner">
        <div className="order-page-heading">
          <p className="eyebrow">ALL HOURS CAFE</p>
          <h1>Your Cart</h1>
          <p>Review your items before checkout.</p>
        </div>
        {items.length === 0 ? (
          <div className="order-empty">
            <span className="empty-cart-icon" aria-hidden="true">
              🛒
            </span>
            <h2>Your cart is empty</h2>
            <p>Browse the menu and add something you love.</p>
            <a className="order-primary-link" href="/menu">
              Browse the Menu
            </a>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-lines">
              {items.map((item) => (
                <article className="cart-line" key={item.id}>
                  <img
                    src={item.imageUrl || "/images/menu/placeholder.jpg"}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = "/images/menu/placeholder.jpg";
                    }}
                  />
                  <div className="cart-line-main">
                    <h2>{item.name}</h2>
                    <p>{money(item.price)} each</p>
                    <div className="cart-line-actions">
                      <div
                        className="cart-quantity"
                        aria-label={`${item.name} quantity`}
                      >
                        <button
                          type="button"
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => update(item.id, item.quantity - 1)}
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${item.name}`}
                          onClick={() => update(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="remove-line"
                        type="button"
                        onClick={() => update(item.id, 0)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <strong className="cart-line-total">
                    {money(item.price * item.quantity)}
                  </strong>
                </article>
              ))}
              <a className="continue-shopping" href="/menu">
                ← Continue shopping
              </a>
            </div>
            <aside className="order-summary-card">
              <h2>Order Summary</h2>
              <div className="summary-row">
                <span>Items subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Tax</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="summary-row summary-total">
                <span>Pickup</span>
                <strong>No fee</strong>
              </div>
              <p className="summary-note">
                Pick up your order at All Hours Cafe.
              </p>
              <a className="order-primary-link full-width" href="/checkout">
                Continue to Checkout
              </a>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

export function CheckoutPage({ user }: { user: User | null }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [contactDetails, setContactDetails] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phoneNumber: "",
  });
  const orderType = "Pickup" as const;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setItems(readCart()), []);
  useEffect(() => {
    if (!user) return;
    apiFetch("/api/v1/auth/profile")
      .then((response) => response.ok ? response.json() as Promise<{ profile?: { fullName: string; email: string; phoneNumber: string | null } }> : Promise.reject())
      .then((body) => {
        if (!body.profile) return;
        setContactDetails({ fullName: body.profile.fullName, email: body.profile.email, phoneNumber: body.profile.phoneNumber || "" });
      })
      .catch(() => undefined);
  }, [user]);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (items.length === 0) {
      setError("Your cart is empty. Add menu items before checkout.");
      return;
    }
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const localTime = String(data.get("deliveryTime") || "");
    const payload = {
      items: items.map((item) => ({
        menuItemId: item.id,
        quantity: item.quantity,
      })),
      customerName: String(data.get("customerName") || ""),
      customerEmail: String(data.get("customerEmail") || ""),
      customerPhone: String(data.get("customerPhone") || ""),
      orderType,
      deliveryTime: localTime ? new Date(localTime).toISOString() : "",
      specialInstructions: String(data.get("specialInstructions") || ""),
    };
    try {
      const response = await apiFetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { order?: Order } & ApiError;
      if (response.status === 401) {
        window.location.assign("/login?returnUrl=%2Fcheckout");
        return;
      }
      if (!response.ok || !body.order)
        throw new Error(
          body.error?.message || "We could not place your order.",
        );
      storeCart([]);
      window.location.assign(`/orders/${body.order.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not reach checkout. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0)
    return (
      <section className="order-page">
        <div className="order-page-inner">
          <div className="order-page-heading">
            <p className="eyebrow">ALL HOURS CAFE</p>
            <h1>Checkout</h1>
          </div>
          <div className="order-empty">
            <h2>Your cart is empty</h2>
            <p>Add a menu item before continuing to checkout.</p>
            <a className="order-primary-link" href="/menu">
              Browse the Menu
            </a>
          </div>
        </div>
      </section>
    );
  if (!user)
    return (
      <section className="order-page">
        <div className="order-page-inner">
          <div className="order-page-heading">
            <p className="eyebrow">ALL HOURS CAFE</p>
            <h1>Checkout</h1>
          </div>
          <div className="order-empty">
            <h2>Sign in to continue</h2>
            <p>Your cart will stay saved in this browser while you sign in.</p>
            <a
              className="order-primary-link"
              href="/login?returnUrl=%2Fcheckout"
            >
              Sign In
            </a>
          </div>
        </div>
      </section>
    );

  return (
    <section className="order-page">
      <div className="order-page-inner">
        <div className="order-page-heading">
          <p className="eyebrow">ALL HOURS CAFE</p>
          <h1>Checkout</h1>
          <p>Enter your contact details and choose a pickup time.</p>
        </div>
        <form className="checkout-layout" onSubmit={submitOrder}>
          <div className="checkout-form-card">
            {error && (
              <div className="order-error" role="alert">
                {error}
              </div>
            )}
            <section className="checkout-form-section">
              <h2>Contact Information</h2>
              <div className="checkout-fields">
                <label>
                  Full name
                  <input
                    name="customerName"
                    autoComplete="name"
                    value={contactDetails.fullName}
                    onChange={(event) => setContactDetails({ ...contactDetails, fullName: event.target.value })}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Email
                  <input
                    name="customerEmail"
                    type="email"
                    autoComplete="email"
                    value={contactDetails.email}
                    onChange={(event) => setContactDetails({ ...contactDetails, email: event.target.value })}
                    required
                    maxLength={255}
                  />
                </label>
                <label>
                  Phone number
                  <input
                    name="customerPhone"
                    type="tel"
                    autoComplete="tel"
                    value={contactDetails.phoneNumber}
                    onChange={(event) => setContactDetails({ ...contactDetails, phoneNumber: event.target.value })}
                    required
                    maxLength={50}
                  />
                </label>
              </div>
            </section>
            <section className="checkout-form-section">
              <h2>Pickup</h2>
              <p className="pickup-location">
                Collect your order at All Hours Cafe. There is no delivery fee.
              </p>
              <div className="checkout-fields optional-fields">
                <label>
                  Preferred pickup time
                  <input name="deliveryTime" type="datetime-local" />
                </label>
                <label className="field-wide">
                  Special instructions
                  <textarea
                    name="specialInstructions"
                    rows={3}
                    maxLength={500}
                    placeholder="Anything we should know?"
                  />
                </label>
              </div>
            </section>
            <p className="payment-note">
              Pay for your order at the cafe when you collect it.
            </p>
          </div>
          <aside className="order-summary-card">
            <h2>Your Order</h2>
            {items.map((item) => (
              <div className="checkout-line" key={item.id}>
                <span>
                  {item.quantity} × {item.name}
                </span>
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
            <div className="summary-row">
              <span>Subtotal (estimate)</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Tax (5%, confirmed at order)</span>
              <span>{money(subtotal * 0.05)}</span>
            </div>
            <div className="summary-row">
              <span>Pickup</span>
              <span>No fee</span>
            </div>
            <button
              className="order-primary-link full-width"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Placing order…" : "Place Order · Pay at Cafe"}
            </button>
            <a className="continue-shopping" href="/cart">
              Back to cart
            </a>
          </aside>
        </form>
      </div>
    </section>
  );
}

export function OrderConfirmationPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch(`/api/v1/orders/${encodeURIComponent(orderId)}`)
      .then(async (response) => {
        const body = (await response.json()) as { order?: Order } & ApiError;
        if (response.status === 401) {
          window.location.assign(
            `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`,
          );
          return;
        }
        if (!response.ok || !body.order)
          throw new Error(body.error?.message || "Order not found.");
        setOrder(body.order);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Order is temporarily unavailable.",
        ),
      );
  }, [orderId]);
  if (error)
    return (
      <section className="order-page">
        <div className="order-page-inner">
          <div className="order-error" role="alert">
            {error}
          </div>
          <a href="/menu">Back to menu</a>
        </div>
      </section>
    );
  if (!order)
    return (
      <section className="order-page">
        <div className="order-page-inner">
          <div className="loading-spinner" role="status">
            <span className="spinner" />
            <span>Loading order…</span>
          </div>
        </div>
      </section>
    );
  return (
    <section className="order-page">
      <div className="order-page-inner confirmation-wrap">
        <div className="order-page-heading">
          <div className="confirmation-check" aria-hidden="true">
            ✓
          </div>
          <p className="eyebrow">ORDER RECEIVED</p>
          <h1>Thank you, {order.customerName.split(" ")[0]}!</h1>
          <p>Your order has been saved. Payment is due at the cafe.</p>
        </div>
        <div className="confirmation-card">
          <div className="confirmation-order-header">
            <div>
              <span>Order number</span>
              <strong>AHC-{String(order.id).padStart(6, "0")}</strong>
            </div>
            <div>
              <span>Order status</span>
              <strong>{order.orderStatus}</strong>
            </div>
          </div>
          {order.items.map((item) => (
            <div className="checkout-line" key={item.menuItemId}>
              <span>
                {item.quantity} × {item.name}
              </span>
              <strong>{money(item.total)}</strong>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{money(order.subTotal)}</span>
          </div>
          <div className="summary-row">
            <span>Tax</span>
            <span>{money(order.tax)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <strong>{money(order.total)}</strong>
          </div>
          <div className="confirmation-delivery">
            <h2>
              {order.orderType === "Pickup"
                ? "Pickup details"
                : "Delivery details"}
            </h2>
            <p>
              {order.customerName} · {order.customerPhone}
            </p>
            {order.orderType === "Pickup" ? (
              <p>
                Pickup at All Hours Cafe
                {order.deliveryTime
                  ? ` · ${new Date(order.deliveryTime).toLocaleString()}`
                  : ""}
              </p>
            ) : (
              <p>
                {order.deliveryAddress}, {order.city}, {order.state}{" "}
                {order.postalCode}
              </p>
            )}
            <p>
              Payment: {order.paymentMethod} · {order.paymentStatus}
            </p>
          </div>
          <a className="order-primary-link" href="/menu">
            Back to Menu
          </a>
        </div>
      </div>
    </section>
  );
}
