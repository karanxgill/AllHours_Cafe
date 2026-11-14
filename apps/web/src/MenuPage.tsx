import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api.js";

type Category = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
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
  categoryId: number;
  spicyLevel: string | null;
  category: { name: string };
};
type CartLine = {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
};

export function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [dietary, setDietary] = useState({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartNotice, setCartNotice] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/menu/categories")
      .then(async (response) => {
        const body = (await response.json()) as {
          categories?: Category[];
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(
            body.error?.message || "Menu categories are unavailable.",
          );
        setCategories(body.categories || []);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Menu is temporarily unavailable.",
        ),
      );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams();
        if (categoryId !== "all") params.set("categoryId", categoryId);
        if (search.trim()) params.set("search", search.trim());
        Object.entries(dietary).forEach(([key, checked]) => {
          if (checked) params.set(key, "true");
        });
        apiFetch(`/api/v1/menu/items?${params}`, { signal: controller.signal })
          .then(async (response) => {
            const body = (await response.json()) as {
              items?: MenuItem[];
              error?: { message?: string };
            };
            if (!response.ok)
              throw new Error(
                body.error?.message || "Menu items are unavailable.",
              );
            setItems(body.items || []);
          })
          .catch((reason: unknown) => {
            if (reason instanceof DOMException && reason.name === "AbortError")
              return;
            setError(
              reason instanceof Error
                ? reason.message
                : "Menu is temporarily unavailable.",
            );
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [categoryId, search, dietary]);

  const selectedCategory = categories.find(
    (category) => String(category.id) === categoryId,
  );
  const activeFilterCount =
    Number(categoryId !== "all") +
    Object.values(dietary).filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0 || Boolean(search);
  const groupedItems = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          items: items.filter((item) => item.categoryId === category.id),
        }))
        .filter((group) => group.items.length > 0),
    [categories, items],
  );

  function addToCart(item: MenuItem) {
    const key = "all-hours-cafe-cart";
    let cart: CartLine[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]") as CartLine[];
      if (Array.isArray(saved)) cart = saved;
    } catch {}
    const existing = cart.find((line) => line.id === item.id);
    if (existing) existing.quantity += 1;
    else
      cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl || "/images/menu/placeholder.jpg",
        quantity: 1,
      });
    localStorage.setItem(key, JSON.stringify(cart));
    window.dispatchEvent(new Event("cafe-cart-updated"));
    setCartNotice(`${item.name} added to your cart.`);
    window.setTimeout(() => setCartNotice(""), 2500);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
  }

  function clearFilters() {
    setCategoryId("all");
    setSearch("");
    setDietary({ vegetarian: false, vegan: false, glutenFree: false });
    setDropdownOpen(false);
  }

  return (
    <section className="menu-section">
      <div className="container menu-container">
        <div className="menu-header">
          <div className="menu-heading-row">
            <div>
              <p className="menu-eyebrow">MADE FRESH, ALL DAY</p>
              <h1>Our Menu</h1>
            </div>
            <p className="menu-result-count">
              {loading ? "Loading items…" : `${items.length} ${items.length === 1 ? "item" : "items"}`}
            </p>
          </div>
          <div className="menu-toolbar">
            <form className="menu-search" onSubmit={submitSearch} role="search">
              <i className="fas fa-search" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search menu items"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dishes and drinks"
              />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
                  ×
                </button>
              )}
            </form>
            <div
              className={`category-dropdown${dropdownOpen ? " active" : ""}`}
            >
              <button
                className="menu-select-button"
                type="button"
                aria-expanded={dropdownOpen}
                aria-controls="menu-category-options"
                onClick={() => setDropdownOpen((open) => !open)}
              >
                <span className="menu-control-label">Category</span>
                <span>{selectedCategory?.name || "All Items"}</span>
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              {dropdownOpen && (
                <div className="category-dropdown-content menu-category-options" id="menu-category-options">
                  <button
                    className={`category-item${categoryId === "all" ? " active" : ""}`}
                    type="button"
                    onClick={() => {
                      setCategoryId("all");
                      setDropdownOpen(false);
                    }}
                  >
                    All Items
                  </button>
                  {categories.map((category) => (
                    <button
                      className={`category-item${categoryId === String(category.id) ? " active" : ""}`}
                      type="button"
                      key={category.id}
                      onClick={() => {
                        setCategoryId(String(category.id));
                        setDropdownOpen(false);
                      }}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-filter-wrap">
              <button
                className={`menu-filter-button${filterPanelOpen ? " active" : ""}`}
                type="button"
                aria-expanded={filterPanelOpen}
                aria-controls="menu-dietary-filters"
                onClick={() => setFilterPanelOpen((open) => !open)}
              >
                <i className="fas fa-sliders-h" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
              </button>
              {filterPanelOpen && (
                <div className="menu-filter-panel" id="menu-dietary-filters">
                  <div className="menu-filter-panel-heading">
                    <strong>Dietary preferences</strong>
                    {hasActiveFilters && (
                      <button type="button" onClick={clearFilters}>Clear all</button>
                    )}
                  </div>
                  <label className="menu-filter-option">
                    <input
                      type="checkbox"
                      checked={dietary.vegetarian}
                      onChange={(event) => setDietary((value) => ({ ...value, vegetarian: event.target.checked }))}
                    />
                    Vegetarian
                  </label>
                  <label className="menu-filter-option">
                    <input
                      type="checkbox"
                      checked={dietary.vegan}
                      onChange={(event) => setDietary((value) => ({ ...value, vegan: event.target.checked }))}
                    />
                    Vegan
                  </label>
                  <label className="menu-filter-option">
                    <input
                      type="checkbox"
                      checked={dietary.glutenFree}
                      onChange={(event) => setDietary((value) => ({ ...value, glutenFree: event.target.checked }))}
                    />
                    Gluten free
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {cartNotice && (
          <div className="menu-cart-notice" role="status">
            {cartNotice} <a href="/cart">View cart</a>
          </div>
        )}
        {loading ? (
          <div className="loading-spinner" role="status">
            <span className="spinner" />
            <span>Loading menu…</span>
          </div>
        ) : error ? (
          <div className="error-message" role="alert">
            <p>{error}</p>
            <button
              className="retry-button"
              type="button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="no-items-message">
            <p>
              {categories.length === 0
                ? "Our menu is being prepared. Please check back soon."
                : "No menu items match your selection."}
            </p>
          </div>
        ) : (
          <div className="menu-items-container">
            {groupedItems.map(({ category, items: categoryItems }) => (
              <section
                className="category-section"
                key={category.id}
                aria-labelledby={`category-${category.id}`}
              >
                <h2 className="category-title" id={`category-${category.id}`}>
                  {category.name}
                </h2>
                {category.description && (
                  <p className="category-description">{category.description}</p>
                )}
                <div className="items-grid">
                  {categoryItems.map((item) => (
                    <article className="menu-item-card" key={item.id}>
                      <div className="menu-item-image">
                        <img
                          src={item.imageUrl || "/images/menu/placeholder.jpg"}
                          alt={item.name}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.src =
                              "/images/menu/placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="item-details">
                        <div className="item-header">
                          <h3 className="item-name">{item.name}</h3>
                          <span className="item-price">
                            ₹{item.price.toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="item-description">{item.description}</p>
                        )}
                        <div className="item-meta">
                          {item.isVegetarian && (
                            <span className="badge vegetarian">Vegetarian</span>
                          )}
                          {item.isVegan && (
                            <span className="badge vegan">Vegan</span>
                          )}
                          {item.isGlutenFree && (
                            <span className="badge gluten-free">
                              Gluten Free
                            </span>
                          )}
                          {item.spicyLevel && (
                            <span className="badge spicy">
                              Spicy: {item.spicyLevel}
                            </span>
                          )}
                        </div>
                        <button
                          className="order-button"
                          type="button"
                          onClick={() => addToCart(item)}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
