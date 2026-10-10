import React, { useMemo, useState } from "react";
import { ArrowRight, Baby, Brain, Dumbbell, Heart, Leaf, Moon, Pill, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";

const CATEGORIES = [
  {
    id: "nutrition",
    label: "Nutrition & Healthy Eating",
    icon: Leaf,
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=540&q=80",
  },
  {
    id: "fitness",
    label: "Fitness & Exercise",
    icon: Dumbbell,
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=540&q=80",
  },
  {
    id: "mental-wellbeing",
    label: "Mental Wellbeing",
    icon: Brain,
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=540&q=80",
  },
  {
    id: "sleep",
    label: "Sleep & Rest",
    icon: Moon,
    image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=540&q=80",
  },
  {
    id: "supplements",
    label: "Vitamins & Supplements",
    icon: Pill,
    image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=540&q=80",
  },
  {
    id: "personal-care",
    label: "Personal Care & Skincare",
    icon: Sparkles,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=540&q=80",
  },
  {
    id: "baby-care",
    label: "Baby & Child Care",
    icon: Baby,
    image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=540&q=80",
  },
  {
    id: "sexual-health",
    label: "Sexual & Reproductive Health",
    icon: Heart,
    image: "https://images.unsplash.com/photo-1516575150278-77136aed6920?auto=format&fit=crop&w=540&q=80",
  },
];

const ARTICLES = [
  {
    category: "nutrition",
    title: "Small steps toward healthier eating",
    description: "Explore how balanced food choices can support health at every stage of life.",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/nutrition.html",
  },
  {
    category: "fitness",
    title: "Make movement part of your routine",
    description: "Learn about the benefits of regular physical activity and building a routine.",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/exerciseandphysicalfitness.html",
  },
  {
    category: "mental-wellbeing",
    title: "Understanding mental health",
    description: "Find out what mental wellbeing includes and where to learn about getting support.",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/mentalhealth.html",
  },
  {
    category: "sleep",
    title: "Why healthy sleep matters",
    description: "Understand sleep, common sleep problems, and ways to find reliable guidance.",
    image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/sleepdisorders.html",
  },
  {
    category: "supplements",
    title: "What to know about dietary supplements",
    description: "Learn about supplement types, safety, and questions to discuss with a health professional.",
    image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/dietarysupplements.html",
  },
  {
    category: "personal-care",
    title: "Your skin and everyday health",
    description: "Discover how skin protects the body and browse trusted information about skin conditions.",
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/skinconditions.html",
  },
  {
    category: "baby-care",
    title: "Infant nutrition: the basics",
    description: "Read evidence-based information about feeding and nutrition during infancy.",
    image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/infantandnewbornnutrition.html",
  },
  {
    category: "sexual-health",
    title: "Explore sexual health information",
    description: "Browse health topics and trusted resources for sexual and reproductive wellbeing.",
    image: "https://images.unsplash.com/photo-1516575150278-77136aed6920?auto=format&fit=crop&w=900&q=80",
    source: "https://medlineplus.gov/sexualhealth.html",
  },
];

const HEALTH_SOURCE = "MedlinePlus, a service of the U.S. National Library of Medicine";

export default function StoreHealthWellnessPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const visibleArticles = useMemo(() => {
    const matching = selectedCategory === "all"
      ? ARTICLES
      : ARTICLES.filter((article) => article.category === selectedCategory);
    return selectedCategory === "all" && !showAll ? matching.slice(0, 5) : matching;
  }, [selectedCategory, showAll]);

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setShowAll(false);
  };

  return (
    <div className="wellness-page">
      <section className="wellness-hero" aria-labelledby="wellness-title">
        <div className="wellness-hero__content">
          <p className="wellness-eyebrow">Health &amp; Wellness</p>
          <h1 id="wellness-title">Healthier Choices.<br /><span>A Brighter Tomorrow.</span></h1>
          <p className="wellness-hero__copy">
            Explore trusted health information and practical guides for everyday wellbeing.
            Your health journey starts with knowledge.
          </p>
          <div className="wellness-trust-points">
            <div><Stethoscope size={22} /><span><strong>Trusted guidance</strong><small>From health information providers</small></span></div>
            <div><ShieldCheck size={22} /><span><strong>Evidence informed</strong><small>Sources linked with every guide</small></span></div>
            <div><Heart size={22} /><span><strong>Everyday wellbeing</strong><small>For you and your family</small></span></div>
          </div>
        </div>
        <div className="wellness-hero__note" aria-hidden="true">
          <span>Healthy habits today,<br />stronger you tomorrow.</span>
          <Heart size={27} />
        </div>
      </section>

      <section className="wellness-section wellness-categories" aria-labelledby="wellness-categories-title">
        <div className="wellness-section__heading">
          <div>
            <span className="wellness-heading-mark" />
            <h2 id="wellness-categories-title">Explore by Category</h2>
            <p>Browse articles tailored to your health and wellness journey.</p>
          </div>
          <button className="wellness-text-link" type="button" onClick={() => selectCategory("all")}>
            View all topics <ArrowRight size={16} />
          </button>
        </div>
        <div className="wellness-category-grid">
          {CATEGORIES.map(({ id, label, icon: Icon, image }) => (
            <button
              className={`wellness-category-card${selectedCategory === id ? " selected" : ""}`}
              key={id}
              type="button"
              onClick={() => selectCategory(id)}
              aria-pressed={selectedCategory === id}
            >
              <span className="wellness-category-card__image">
                <img src={image} alt="" loading="lazy" />
                <span className="wellness-category-card__icon"><Icon size={19} /></span>
              </span>
              <span className="wellness-category-card__label">{label}</span>
              <span className="wellness-category-card__action">Explore <ArrowRight size={14} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="wellness-section wellness-articles" id="wellness-articles" aria-labelledby="wellness-articles-title">
        <div className="wellness-section__heading">
          <div>
            <h2 id="wellness-articles-title">{selectedCategory === "all" ? "Featured Articles" : CATEGORIES.find((category) => category.id === selectedCategory)?.label}</h2>
            <p>Clear, useful starting points for learning more about your health.</p>
          </div>
          {selectedCategory !== "all" ? (
            <button className="wellness-text-link" type="button" onClick={() => selectCategory("all")}>
              Clear filter <ArrowRight size={16} />
            </button>
          ) : (
            <button className="wellness-text-link" type="button" onClick={() => setShowAll((current) => !current)}>
              {showAll ? "Show featured" : "View all articles"} <ArrowRight size={16} />
            </button>
          )}
        </div>
        <div className="wellness-article-grid">
          {visibleArticles.map((article) => {
            const category = CATEGORIES.find((item) => item.id === article.category);
            return (
              <article className="wellness-article-card" key={article.category}>
                <a href={article.source} target="_blank" rel="noopener noreferrer" aria-label={`Read ${article.title} on MedlinePlus`}>
                  <img className="wellness-article-card__image" src={article.image} alt="" loading="lazy" />
                </a>
                <div className="wellness-article-card__body">
                  <span className="wellness-article-card__category">{category.label}</span>
                  <h3><a href={article.source} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
                  <p>{article.description}</p>
                  <a className="wellness-article-card__read" href={article.source} target="_blank" rel="noopener noreferrer">
                    Read on MedlinePlus <ArrowRight size={15} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
        <p className="wellness-source-note">
          Article information and further reading are provided by{" "}
          <a href="https://medlineplus.gov/" target="_blank" rel="noopener noreferrer">{HEALTH_SOURCE}</a>.
          Content is for general awareness and does not replace advice from a healthcare professional.
        </p>
      </section>

      <section className="wellness-quote">
        <Leaf size={28} aria-hidden="true" />
        <div>
          <p>Wellness isn’t a destination, it’s a daily choice.</p>
          <span>Better choices today. A healthier you tomorrow.</span>
        </div>
        <Leaf size={28} aria-hidden="true" />
      </section>
      <div className="wellness-shop-link">
        <Link to="/shop">Explore pharmacy products <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}
