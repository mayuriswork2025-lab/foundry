import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "How do I apply with my startup idea?",
    answer:
      "It's very simple! Create an account, click 'Submit your idea', add a pitch and a description of your startup, and set your stage and domain. Your profile goes live within minutes after verification.",
  },
  {
    question: "What are the fees for startups?",
    answer:
      "Foundry charges a 3% fee only on funding that's actually disbursed through the platform. No listing fees, no mandatory subscription. The Pro plan at $49/month reduces the fee to 2% for multi-founder teams.",
  },
  {
    question: "How are mentors verified?",
    answer:
      "Each mentor must provide identity and experience credentials. We verify these and assign a trust score. Founders can view a mentor's complete profile before accepting a match.",
  },
  {
    question: "Is funding secure?",
    answer:
      "Yes, all funding flows through our secure platform. Funds are held until milestone confirmation, then released to the founder. In case of disputes, our team intervenes to find a solution.",
  },
  {
    question: "What support do mentors provide?",
    answer:
      "Mentors offer regular 1:1 sessions, review milestones, and help prepare founders for demo day. Our included support covers up to 10 mentor sessions per cohort at no extra cost.",
  },
  {
    question: "Can I leave a mentorship program?",
    answer:
      "Yes. Mentorship terms are set by each mentor (flexible, moderate, or fixed-term). If a match isn't working out, you can request a new mentor at any time before the next cohort starts.",
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="py-32 px-6 pb-80">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-normal mb-6 text-balance font-serif">Frequently asked questions</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about Foundry. Have a question not listed? Contact our support.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3 py-0 my-0">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-foreground/30"
            >
              <AccordionTrigger className="text-left text-base font-medium text-foreground hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed text-sm">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
