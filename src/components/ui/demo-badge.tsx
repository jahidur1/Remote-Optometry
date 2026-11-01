
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

export function DemoBadge() {
  return (
    <Badge variant="outline" className="bg-muted/50 text-[10px] font-medium border-accent/20 text-accent-foreground flex items-center gap-1 px-2 py-0">
      <AlertCircle className="size-3" />
      FICTIONAL DEMO DATA
    </Badge>
  )
}
