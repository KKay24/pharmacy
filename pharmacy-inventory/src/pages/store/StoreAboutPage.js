import React from "react";
import {
  ArrowRight,
  Baby,
  Check,
  Clock3,
  Coins,
  Headset,
  Heart,
  Leaf,
  MapPin,
  PackageCheck,
  Pill,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";

const SERVICES = [
  {
    title: "Prescription & OTC Medicines",
    description: "Browse medicines and submit prescriptions for pharmacy review.",
    icon: Pill,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=720&q=80",
    href: "/shop",
  },
  {
    title: "Medical Supplies",
    description: "Explore medical and first-aid supplies available in the catalogue.",
    icon: ShieldCheck,
    image: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=720&q=80",
    href: "/shop",
  },
  {
    title: "Personal Care & Wellness",
    description: "Find personal-care products and trusted health information.",
    icon: Leaf,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=720&q=80",
    href: "/health-wellness",
  },
  {
    title: "Baby & Mother Care",
    description: "Browse customer-visible products for babies and families.",
    icon: Baby,
    image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=720&q=80",
    href: "/shop",
  },
  {
    title: "Convenient Online Shopping",
    description: "Check product availability and submit orders through the store.",
    icon: ShoppingBag,
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=720&q=80",
    href: "/shop",
  },
  {
    title: "Customer Support",
    description: "Contact the pharmacy team with product, order, or prescription questions.",
    icon: UserRound,
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=720&q=80",
    href: "/contact",
  },
];

const VALUES = [
  {
    title: "Accessible",
    text: "Browse pharmacy products and services online.",
    icon: Coins,
  },
  {
    title: "Stock-aware",
    text: "Customer product availability comes from pharmacy inventory.",
    icon: PackageCheck,
  },
  {
    title: "Convenient",
    text: "Submit orders and prescriptions through the customer store.",
    icon: ShoppingBag,
  },
  {
    title: "Here to help",
    text: "Use the contact page or support chat to send the pharmacy a message.",
    icon: Headset,
  },
];

export default function StoreAboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero__content">
          <p className="about-eyebrow">About Us</p>
          <h1 id="about-title">MediQuick Pharmacy</h1>
          <h2>Your pharmacy for everyday health needs.</h2>
          <p>
            Browse pharmacy products, submit prescriptions for review, and reach
            out to the pharmacy team through the customer store.
          </p>
          <div className="about-hero__highlights">
            <span><ShieldCheck size={19} /> Pharmacy products</span>
            <span><PackageCheck size={19} /> Inventory availability</span>
            <span><Headset size={19} /> Customer support</span>
          </div>
        </div>
        <p className="about-hero__note" aria-hidden="true">Better health for<br />a brighter tomorrow.<Heart size={24} /></p>
      </section>

      <section className="about-intro about-container" aria-labelledby="about-partner-title">
        <div className="about-intro__image">
          <img
            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1100&q=85"
            alt="A healthcare professional speaking with a pharmacy customer"
            loading="lazy"
          />
          <span className="about-intro__image-badge"><Heart size={19} /></span>
        </div>
        <div className="about-intro__copy">
          <p className="about-section-kicker">Who we are</p>
          <h2 id="about-partner-title">More than a pharmacy —<br />your health partner.</h2>
          <p>
            MediQuick brings pharmacy shopping and support together in one
            customer experience. The online store displays customer-visible
            products from the pharmacy inventory, while prescription orders are
            submitted for review by the pharmacy.
          </p>
          <Link to="/contact" className="about-inline-link">Get in touch <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="about-services about-container" aria-labelledby="about-services-title">
        <div className="about-section-heading">
          <p className="about-section-kicker">What we offer</p>
          <h2 id="about-services-title">Everything you need for better health</h2>
          <p>Explore pharmacy services and products available through MediQuick.</p>
        </div>
        <div className="about-service-grid">
          {SERVICES.map(({ title, description, icon: Icon, image, href }) => (
            <Link to={href} className="about-service-card" key={title}>
              <span className="about-service-card__image"><img src={image} alt="" loading="lazy" /></span>
              <span className="about-service-card__icon"><Icon size={19} /></span>
              <span className="about-service-card__title">{title}</span>
              <span className="about-service-card__description">{description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="about-mission about-container" aria-labelledby="about-mission-title">
        <div className="about-mission__icon"><Check size={30} /></div>
        <div>
          <p className="about-section-kicker">Our focus</p>
          <h2 id="about-mission-title">Making pharmacy access clearer, more convenient, and customer-focused.</h2>
        </div>
        <img
          src="https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=800&q=80"
          alt=""
          loading="lazy"
        />
      </section>

      <section className="about-values about-container" aria-labelledby="about-values-title">
        <div className="about-section-heading">
          <p className="about-section-kicker">Why choose us</p>
          <h2 id="about-values-title">Your health matters to us</h2>
        </div>
        <div className="about-value-grid">
          {VALUES.map(({ title, text, icon: Icon }) => (
            <div className="about-value" key={title}>
              <span className="about-value__icon"><Icon size={24} /></span>
              <span><strong>{title}</strong><small>{text}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="about-visit" aria-labelledby="about-visit-title">
        <div className="about-visit__image">
          <img
            src="https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?auto=format&fit=crop&w=1100&q=85"
            alt="Pharmacy shelves with health and personal care products"
            loading="lazy"
          />
        </div>
        <div className="about-visit__content">
          <p className="about-section-kicker">Visit us</p>
          <h2 id="about-visit-title">We’re here for you</h2>
          <p>Contact the pharmacy team for help with products, orders, or prescriptions.</p>
          <div className="about-visit__details">
            <span><MapPin size={19} /><span><strong>Cairo Road, Lusaka</strong><small>Store location listed in contact details</small></span></span>
            <a href="tel:+260977000000"><Truck size={19} /><span><strong>+260 97 700 0000</strong><small>Phone / WhatsApp</small></span></a>
            <span><Clock3 size={19} /><span><strong>Mon–Sat, 8 AM–8 PM</strong><small>Sunday: 9 AM–5 PM</small></span></span>
          </div>
          <div className="about-visit__actions">
            <a
              className="about-directions-button"
              href="https://www.google.com/maps/search/?api=1&query=Cairo+Road%2C+Lusaka"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={16} /> Get directions
            </a>
            <Link to="/contact" className="about-inline-link">Contact us <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
