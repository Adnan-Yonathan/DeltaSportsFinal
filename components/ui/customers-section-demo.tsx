import { CustomersSection } from "@/components/ui/customers-section"

const customers = [
  {
    src: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 1",
    height: 24,
  },
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 2",
    height: 24,
  },
  {
    src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 3",
    height: 24,
  },
  {
    src: "https://images.unsplash.com/photo-1474631245212-32dc3c8310c6?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 4",
    height: 24,
  },
  {
    src: "https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 5",
    height: 24,
  },
  {
    src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 6",
    height: 24,
  },
  {
    src: "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 7",
    height: 24,
  },
  {
    src: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=240&q=80",
    alt: "Customer 8",
    height: 24,
  },
]

export function CustomersSectionDemo() {
  return (
    <CustomersSection customers={customers} />
  )
}
