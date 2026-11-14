export function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-page-hero">
        <p className="about-eyebrow">OUR STORY</p>
        <h1>A little more about All Hours Cafe</h1>
        <p>
          Good coffee, thoughtful food, and a welcoming place to spend time,
          whatever your day looks like.
        </p>
      </section>
      <section className="about-story">
        <div className="about-story-copy">
          <p className="about-eyebrow">MADE FOR EVERY HOUR</p>
          <h2>A neighbourhood cafe with room for everyone</h2>
          <p>
            All Hours Cafe was founded in 2020 around a simple idea: there
            should always be a comfortable place to find a good cup of coffee
            and a freshly prepared meal.
          </p>
          <p>
            Our baristas and kitchen team care about the small details, from the
            ingredients we choose to the friendly service that makes a quick
            visit feel like a welcome break.
          </p>
          <a className="about-page-link" href="/menu">
            Explore our menu <span aria-hidden="true">→</span>
          </a>
        </div>
        <img
          src="/images/cook.jpeg"
          alt="A member of the All Hours Cafe kitchen team preparing food"
          loading="lazy"
        />
      </section>
      <section className="about-values" aria-label="What matters to us">
        <article>
          <span>01</span>
          <h2>Good ingredients</h2>
          <p>
            We prepare food with care and choose ingredients for quality and
            freshness.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Always welcoming</h2>
          <p>
            Come in for a quiet coffee, a meal with friends, or a place to get
            some work done.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Here when you need us</h2>
          <p>
            Our cafe is open around the clock, so there is always time for a
            good break.
          </p>
        </article>
      </section>
    </div>
  );
}
