import { FormEvent, useEffect, useState } from "react";
import { MenuPage } from "./MenuPage.js";
import { CartPage, CheckoutPage, OrderConfirmationPage } from "./OrderPages.js";
import { ReservationPage } from "./ReservationPage.js";
import { ContactPage } from "./ContactPage.js";
import { AdminPage } from "./AdminPage.js";
import { AboutPage } from "./AboutPage.js";
import { apiFetch } from "./api.js";

type User = { id: number; fullName: string; email: string; role: string };
type ApiError = {
  error?: { message?: string; fields?: Record<string, string[] | undefined> };
  message?: string;
};
type HomeHighlight = {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
};
type HomeGroup = { section: string; items: HomeHighlight[] };

const API = "/api/v1/auth";
const fallbackHighlights: HomeGroup[] = [
  {
    section: "Breakfast",
    items: [
      {
        id: 1,
        title: "Avocado Toast",
        description: "Fresh avocado on artisanal bread",
        imageUrl: "/images/Items/breakfast/avocado-toast.jpg",
      },
      {
        id: 2,
        title: "Breakfast Burrito",
        description: "Eggs, cheese, and fresh vegetables",
        imageUrl: "/images/Items/breakfast/breakfast-burrito.jpg",
      },
      {
        id: 3,
        title: "Fluffy Pancakes",
        description: "Served with maple syrup and butter",
        imageUrl: "/images/Items/breakfast/fluffy-pancake.jpg",
      },
    ],
  },
  {
    section: "Beverages",
    items: [
      {
        id: 4,
        title: "Fresh Coffee",
        description: "Premium roasted coffee",
        imageUrl: "/images/coffee.jpg",
      },
    ],
  },
];

async function readResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function safeReturnPath(): string {
  const candidate = new URLSearchParams(window.location.search).get(
    "returnUrl",
  );
  return candidate?.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/";
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [highlightGroups, setHighlightGroups] = useState<HomeGroup[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isAdminRoute = path.startsWith("/admin");
  const isSignup = path === "/signup";
  const isLogin = path === "/login";
  const orderRoute = path.match(/^\/orders\/(\d+)$/);
  const reservationRoute = path.match(/^\/reservations\/(\d+)$/);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    apiFetch(`${API}/me`)
      .then((response) => readResponse<{ user: User | null }>(response))
      .then((body) => setUser(body.user))
      .catch(() => setUser(null))
      .finally(() => setAuthResolved(true));

    if (path === "/") {
      apiFetch("/api/v1/home")
        .then((response) =>
          response.ok
            ? readResponse<{ highlights: HomeGroup[] }>(response)
            : Promise.reject(new Error("Home request failed")),
        )
        .then((body) => setHighlightGroups(body.highlights))
        .catch(() => setHighlightGroups([]));
    }

    if (new URLSearchParams(window.location.search).get("registered") === "1") {
      setNotice("Registration successful! Welcome to All Hours Cafe.");
    }
  }, [path]);

  useEffect(() => {
    const updateCartCount = () => {
      try {
        const cart = JSON.parse(
          localStorage.getItem("all-hours-cafe-cart") || "[]",
        ) as Array<{ quantity?: number }>;
        setCartCount(
          cart.reduce((total, line) => total + (Number(line.quantity) || 0), 0),
        );
      } catch {
        setCartCount(0);
      }
    };
    updateCartCount();
    window.addEventListener("cafe-cart-updated", updateCartCount);
    window.addEventListener("storage", updateCartCount);
    return () => {
      window.removeEventListener("cafe-cart-updated", updateCartCount);
      window.removeEventListener("storage", updateCartCount);
    };
  }, []);

  useEffect(() => {
    if (path !== "/") return;
    const elements = document.querySelectorAll<HTMLElement>(
      ".animate-on-scroll:not(.animated)",
    );
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("animated"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          const delay = Number(element.dataset.delay || 0);
          window.setTimeout(() => element.classList.add("animated"), delay);
          observer.unobserve(element);
        });
      },
      { threshold: 0.12 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [highlightGroups, path]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = isSignup
      ? {
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          confirmPassword: String(form.get("confirmPassword") ?? ""),
        }
      : {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          rememberMe: form.get("rememberMe") === "on",
        };

    try {
      const response = await apiFetch(
        `${API}/${isSignup ? "signup" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await readResponse<{ user?: User } & ApiError>(response);
      if (!response.ok) {
        setError(
          body.error?.message ??
            "We could not complete your request. Please try again.",
        );
        const fields = body.error?.fields;
        if (fields)
          setFieldErrors(
            Object.fromEntries(
              Object.entries(fields).flatMap(([key, messages]) =>
                messages?.[0] ? [[key, messages[0]]] : [],
              ),
            ),
          );
        return;
      }

      if (isSignup) {
        window.location.assign("/?registered=1");
        return;
      }
      if (body.user) setUser(body.user);
      window.location.assign(safeReturnPath());
    } catch {
      setError("We could not reach the sign-in service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await apiFetch(`${API}/logout`, { method: "POST" });
      setUser(null);
      window.location.assign("/");
    } catch {
      setError("We could not sign you out. Please try again.");
    }
  }

  const navigation = (
    <>
      <div className={`nav-left${mobileMenuOpen ? " show" : ""}`}>
        <a
          className={`nav-link${path === "/" ? " active" : ""}`}
          href="/"
          aria-current={path === "/" ? "page" : undefined}
        >
          Home
        </a>
        <a
          className={`nav-link${path === "/menu" ? " active" : ""}`}
          href="/menu"
          aria-current={path === "/menu" ? "page" : undefined}
        >
          Menu
        </a>
        <a
          className={`nav-link${path.startsWith("/reservations") ? " active" : ""}`}
          href="/reservations"
          aria-current={path.startsWith("/reservations") ? "page" : undefined}
        >
          Reservations
        </a>
      </div>
      <div className="nav-center">
        <a className="logo-link" href="/" aria-label="All Hours Cafe home">
          <img
            src="/images/logo.png"
            alt="All Hours Cafe"
            className="logo-img"
          />
        </a>
      </div>
      <div className={`nav-right${mobileMenuOpen ? " show" : ""}`}>
        <a
          className={`nav-link${path === "/about" ? " active" : ""}`}
          href="/about"
          aria-current={path === "/about" ? "page" : undefined}
        >
          About
        </a>
        <a
          className={`nav-link${path === "/contact" ? " active" : ""}`}
          href="/contact"
          aria-current={path === "/contact" ? "page" : undefined}
        >
          Contact
        </a>
        <div className="cart-wrapper">
          <a
            className={`cart-link${path === "/cart" ? " active" : ""}`}
            href="/cart"
            aria-label={`Shopping cart, ${cartCount} items`}
            aria-current={path === "/cart" ? "page" : undefined}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 8H6" />
              <circle cx="10" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
            </svg>
            <span className="cart-count">{cartCount}</span>
          </a>
        </div>
        {!authResolved ? (
          <span className="auth-links-placeholder" aria-hidden="true" />
        ) : user ? (
          <div className="auth-links signed-in-links">
            <span className="welcome-user">
              Hi, {user.fullName.split(" ")[0]}
            </span>
            {(user.role === "Admin" || user.role === "SuperAdmin") && (
              <a className="nav-link" href="/admin">
                Admin
              </a>
            )}
            <button type="button" className="logout-link" onClick={logout}>
              Log out
            </button>
          </div>
        ) : (
          <div className="auth-links">
            <a
              className={isLogin ? "nav-link active" : "nav-link"}
              href="/login"
              aria-current={isLogin ? "page" : undefined}
            >
              Log in
            </a>
            <a
              className={
                isSignup
                  ? "nav-link signup-link active"
                  : "nav-link signup-link"
              }
              href="/signup"
              aria-current={isSignup ? "page" : undefined}
            >
              Sign up
            </a>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {!isAdminRoute && (
        <header>
          <nav
            className={`navbar${mobileMenuOpen ? " menu-open" : ""}`}
            aria-label="Main navigation"
          >
            <button
              className="mobile-menu-toggle"
              type="button"
              aria-label={
                mobileMenuOpen ? "Close navigation" : "Open navigation"
              }
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((value) => !value)}
            >
              <span aria-hidden="true">{mobileMenuOpen ? "×" : "☰"}</span>
            </button>
            {navigation}
          </nav>
        </header>
      )}

      <main className={isAdminRoute ? "admin-app-main" : undefined}>
        {path.startsWith("/admin") ? (
          <AdminPage path={path} />
        ) : path === "/menu" ? (
          <MenuPage />
        ) : path === "/about" ? (
          <AboutPage />
        ) : path === "/cart" ? (
          <CartPage />
        ) : path === "/checkout" ? (
          <CheckoutPage user={user} />
        ) : orderRoute ? (
          <OrderConfirmationPage orderId={orderRoute[1]} />
        ) : path === "/reservations" ? (
          <ReservationPage user={user} />
        ) : path === "/reservations/create" ? (
          <ReservationPage user={user} />
        ) : reservationRoute ? (
          <ReservationPage user={user} reservationId={reservationRoute[1]} />
        ) : path === "/contact" ? (
          <ContactPage />
        ) : isLogin || isSignup ? (
          <section className="auth-container">
            <div className="auth-form">
              <h2>{isSignup ? "Create Account" : "Welcome Back"}</h2>
              {notice && (
                <div className="alert alert-success" role="status">
                  {notice}
                </div>
              )}
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={submitAuth} noValidate>
                {isSignup && (
                  <Field
                    label="Full Name"
                    name="fullName"
                    placeholder="Enter your full name"
                    autoComplete="name"
                    error={fieldErrors.fullName}
                  />
                )}
                <Field
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder={
                    isSignup ? "Enter your email address" : "Enter your email"
                  }
                  autoComplete="email"
                  error={fieldErrors.email}
                />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  placeholder={
                    isSignup ? "Create a password" : "Enter your password"
                  }
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  error={fieldErrors.password}
                />
                {isSignup ? (
                  <Field
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    error={fieldErrors.confirmPassword}
                  />
                ) : (
                  <div className="form-group login-options">
                    <label className="remember-label">
                      <input type="checkbox" name="rememberMe" /> Remember me
                    </label>
                    <div className="forgot-password">
                      <a
                        href="/forgot-password"
                        onClick={(event) => {
                          event.preventDefault();
                          setNotice(
                            "Password reset will be added in a later account update.",
                          );
                        }}
                      >
                        Forgot your password?
                      </a>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading}>
                  {loading
                    ? "Please wait…"
                    : isSignup
                      ? "Create Account"
                      : "Login"}
                </button>
                <div className="form-footer">
                  {isSignup ? (
                    <p>
                      Already have an account? <a href="/login">Login here</a>
                    </p>
                  ) : (
                    <p>
                      Don't have an account? <a href="/signup">Sign up here</a>
                    </p>
                  )}
                </div>
              </form>
            </div>
          </section>
        ) : (
          <HomePage
            groups={
              highlightGroups.length > 0 ? highlightGroups : fallbackHighlights
            }
            notice={path === "/" ? notice : ""}
          />
        )}
      </main>

      {!isAdminRoute && (
        <footer className="footer">
          <div className="container">
            <div className="footer-top">
              <div className="footer-logo">
                <img
                  src="/images/logo.png"
                  alt="All Hours Cafe"
                  className="footer-logo-img"
                />
                <p>
                  Your perfect destination for great coffee, delicious food, and
                  a welcoming atmosphere.
                </p>
              </div>
              <div className="footer-content">
                <div className="footer-section">
                  <h3>Explore</h3>
                  <ul>
                    <li>
                      <a href="/">Home</a>
                    </li>
                    <li>
                      <a href="/menu">Our Menu</a>
                    </li>
                    <li>
                      <a href="/reservations">Reservations</a>
                    </li>
                    <li>
                      <a href="/about">About Us</a>
                    </li>
                  </ul>
                </div>
                <div className="footer-section">
                  <h3>Visit Us</h3>
                  <p>
                    123 Cafe Street, City Center
                    <br />
                    Open 24/7
                    <br />
                    +91 98765 43210
                    <br />
                    hello@allhourscafe.com
                  </p>
                </div>
                <div className="footer-section">
                  <h3>Connect With Us</h3>
                  <div className="social-links">
                    <a href="#facebook" aria-label="Facebook">
                      f
                    </a>
                    <a href="#instagram" aria-label="Instagram">
                      ◎
                    </a>
                    <a href="#pinterest" aria-label="Pinterest">
                      p
                    </a>
                  </div>
                  <div className="newsletter">
                    <h4>Subscribe to our newsletter</h4>
                    <form onSubmit={(event) => event.preventDefault()}>
                      <input
                        type="email"
                        aria-label="Email address"
                        placeholder="Your email address"
                      />
                      <button aria-label="Subscribe" type="submit">
                        →
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="footer-bottom">
              <p>
                © {new Date().getFullYear()} All Hours Cafe. All rights
                reserved.
              </p>
              <div className="footer-links">
                <a href="#privacy">Privacy Policy</a>
                <a href="#terms">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  autoComplete: string;
  error?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <input
        className="form-control"
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span className="text-danger" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

function HomePage({ groups, notice }: { groups: HomeGroup[]; notice: string }) {
  return (
    <>
      <section id="hero" aria-label="All Hours Cafe" />

      <section id="features">
        <div className="container">
          <div
            className="section-header animate-on-scroll"
            data-animation="fade-down"
          >
            <h2>Why Choose Us</h2>
            <p>We offer the best cafe experience in town</p>
          </div>
          <div className="features-container">
            <div className="features-grid">
              <Feature icon="fa-clock" title="24/7 Service">
                We're always open to serve you delicious food and beverages, no
                matter what time of day or night.
              </Feature>
              <Feature icon="fa-coffee" title="Premium Coffee">
                Enjoy our selection of premium coffee beans sourced from the
                finest coffee regions around the world.
              </Feature>
              <Feature icon="fa-utensils" title="Delicious Food">
                Our menu features a variety of delicious dishes made with fresh,
                locally-sourced ingredients.
              </Feature>
              <Feature icon="fa-wifi" title="Free Wi-Fi">
                Stay connected with our high-speed internet while enjoying your
                favorite coffee and food.
              </Feature>
            </div>
          </div>
        </div>
      </section>

      <section id="menu-preview">
        <div className="container">
          <div
            className="section-header animate-on-scroll"
            data-animation="fade-down"
          >
            <h2>Our Menu Highlights</h2>
            <p>Explore our delicious offerings</p>
          </div>
          <div className="menu-categories">
            {groups.map((group, index) => (
              <div
                className="menu-category animate-on-scroll"
                data-animation="fade-up"
                data-delay={index * 200}
                key={group.section}
              >
                <h3>{group.section}</h3>
                <div className="menu-items">
                  {group.items.map((item) => (
                    <div
                      className={`menu-item${item.title === "Fresh Coffee" ? " fresh-coffee" : ""}`}
                      key={item.id}
                    >
                      <a href="/menu">
                        <img
                          src={item.imageUrl || "/images/Items/placeholder.jpg"}
                          alt={item.title}
                          loading="lazy"
                        />
                        <div className="item-info">
                          <h4>{item.title}</h4>
                          <p>{item.description}</p>
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div
            className="view-menu-button animate-on-scroll"
            data-animation="fade-up"
          >
            <a href="/menu" className="btn-primary">
              View Full Menu
            </a>
          </div>
        </div>
      </section>

      <section id="about">
        <div className="container">
          <div className="about-content">
            <div
              className="about-text animate-on-scroll"
              data-animation="fade-right"
            >
              <div
                className="about-title-wrapper animate-on-scroll"
                data-animation="fade-up"
                data-delay="200"
              >
                <h2 className="about-title">Our Story</h2>
              </div>
              <p
                className="lead animate-on-scroll"
                data-animation="fade-up"
                data-delay="400"
              >
                Your perfect destination for great coffee, delicious food, and a
                welcoming atmosphere.
              </p>
              <div
                className="about-paragraph animate-on-scroll"
                data-animation="fade-up"
                data-delay="600"
              >
                <p>
                  Founded in 2020, AllHoursCafe has quickly become a favorite
                  spot for locals and visitors alike. We take pride in serving
                  the finest coffee and fresh, locally-sourced food in a
                  comfortable environment perfect for work, meetings, or casual
                  gatherings.
                </p>
              </div>
              <div
                className="about-paragraph animate-on-scroll"
                data-animation="fade-up"
                data-delay="800"
              >
                <p>
                  Our team of passionate baristas and chefs work tirelessly to
                  ensure that every cup of coffee and every dish that leaves our
                  kitchen meets our high standards of quality and taste.
                </p>
              </div>
              <a
                href="/about"
                className="btn-link animate-on-scroll"
                data-animation="fade-up"
                data-delay="1000"
              >
                Learn more about us{" "}
                <i className="fas fa-arrow-right" aria-hidden="true" />
              </a>
            </div>
            <div
              className="about-image animate-on-scroll"
              data-animation="fade-left"
            >
              <img
                src="/images/cook.jpeg"
                alt="Our chef"
                className="animated"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="reservation-cta">
        <div className="container">
          <div className="reservation-content">
            <h2>Reserve Your Table Today</h2>
            <p>
              Experience the perfect dining atmosphere at AllHoursCafe. Skip the
              wait and secure your spot with our easy online reservation system.
            </p>
            <div className="reservation-features">
              <ReservationFeature icon="fa-calendar-check" title="Easy Booking">
                Simple online process, book in seconds
              </ReservationFeature>
              <ReservationFeature icon="fa-clock" title="Flexible Hours">
                Morning to late night availability
              </ReservationFeature>
              <ReservationFeature icon="fa-users" title="Group Friendly">
                Accommodations for parties of all sizes
              </ReservationFeature>
            </div>
            <a href="/reservations" className="cta-button primary">
              Reserve Now
            </a>
          </div>
        </div>
      </section>
      {notice && (
        <div className="registration-notice" role="status">
          {notice}
        </div>
      )}
    </>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: string;
}) {
  return (
    <div className="feature-card animate-on-scroll" data-animation="fade-up">
      <div className="feature-icon">
        <i className={`fas ${icon}`} aria-hidden="true" />
      </div>
      <div className="feature-content">
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
      <div className="feature-hover-effect" />
    </div>
  );
}

function ReservationFeature({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: string;
}) {
  return (
    <div className="reservation-feature">
      <i className={`fas ${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
