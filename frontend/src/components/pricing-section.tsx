import { useRef, useEffect, useState } from "react"
import { PropertyBookingCard } from "./property-booking-card"

const startups = [
  {
    propertyName: "EcoTrack",
    location: "CleanTech",
    duration: "Seed stage",
    availableDate: "Cohort 5",
    image: "/images/property-beach-villa.jpg",
    pricePerNight: 450,
    propertyType: "CleanTech",
    features: ["AI-powered", "B2B SaaS", "Carbon tracking"],
    amenities: ["Team of 4", "Backed by mentors", "Remote-first"],
    rating: 4.9,
  },
  {
    propertyName: "FinFlow",
    location: "FinTech",
    duration: "Pre-seed",
    availableDate: "Cohort 5",
    image: "/images/property-mountain-cabin.jpg",
    pricePerNight: 320,
    propertyType: "FinTech",
    features: ["Cash-flow forecasting", "B2B SaaS", "API-first"],
    amenities: ["Team of 3", "Backed by mentors", "Remote-first"],
    rating: 4.8,
  },
  {
    propertyName: "MedLink",
    location: "HealthTech",
    duration: "Seed stage",
    availableDate: "Cohort 4",
    image: "/images/property-city-loft.jpg",
    pricePerNight: 280,
    propertyType: "HealthTech",
    features: ["Telehealth", "HIPAA-ready", "Mobile-first"],
    amenities: ["Team of 6", "Backed by mentors", "Hybrid"],
    rating: 4.7,
  },
  {
    propertyName: "AgroSense",
    location: "AgriTech",
    duration: "Series Seed",
    availableDate: "Cohort 3",
    image: "/images/property-tuscan-estate.jpg",
    pricePerNight: 520,
    propertyType: "AgriTech",
    features: ["IoT sensors", "Precision farming", "Hardware"],
    amenities: ["Team of 8", "Backed by mentors", "On-site"],
    rating: 4.9,
  },
  {
    propertyName: "EduSpark",
    location: "EdTech",
    duration: "Pre-seed",
    availableDate: "Cohort 5",
    image: "/images/property-tropical-bungalow.jpg",
    pricePerNight: 180,
    propertyType: "EdTech",
    features: ["Adaptive learning", "B2C", "Mobile app"],
    amenities: ["Team of 2", "Backed by mentors", "Remote-first"],
    rating: 4.8,
  },
  {
    propertyName: "UrbanGrid",
    location: "PropTech",
    duration: "Seed stage",
    availableDate: "Cohort 4",
    image: "/images/property-lakefront-modern.jpg",
    pricePerNight: 380,
    propertyType: "PropTech",
    features: ["Smart buildings", "B2B SaaS", "Analytics"],
    amenities: ["Team of 5", "Backed by mentors", "Hybrid"],
    rating: 4.9,
  },
]

export function PricingSection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const positionRef = useRef(0)
  const animationRef = useRef<number | undefined>(undefined)

  const duplicatedStartups = [...startups, ...startups, ...startups]

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) return

    const speed = isHovered ? 0.3 : 1 // Slow down on hover instead of changing animation duration
    let lastTime = performance.now()

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      positionRef.current += speed * (deltaTime / 16)

      const totalWidth = scrollContainer.scrollWidth / 3

      if (positionRef.current >= totalWidth) {
        positionRef.current = 0
      }

      scrollContainer.style.transform = `translateX(-${positionRef.current}px)`
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isHovered])

  return (
    <section id="pricing" className="py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-normal mb-6 text-balance font-serif">Featured startups</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Discover promising startups from our current cohort. See what they're building.
        </p>
      </div>

      <div className="relative w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div ref={scrollRef} className="flex gap-6" style={{ width: "fit-content" }}>
          {duplicatedStartups.map((startup, index) => (
            <div key={index} className="flex-shrink-0 w-[85vw] sm:w-[60vw] lg:w-[400px]">
              <PropertyBookingCard {...startup} onBook={() => console.log(`Viewing ${startup.propertyName}`)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
