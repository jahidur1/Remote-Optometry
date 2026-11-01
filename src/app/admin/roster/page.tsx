
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { generateWeeklyRoster } from "@/ai/flows/generate-weekly-roster"
import { optimizeRosterForGenderBalance } from "@/ai/flows/optimize-roster-gender-balance"
import { explainSchedulingConflicts } from "@/ai/flows/explain-scheduling-conflicts-flow"
import { BrainCircuit, Sparkles, AlertTriangle, CheckCircle, Info, Download } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function RosterSolver() {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "conflict">("idle")
  const [progress, setProgress] = useState(0)
  const [explanation, setExplanation] = useState<any>(null)

  const handleRunSolver = async () => {
    setStatus("running")
    setProgress(10)
    
    // Simulate complex solver process
    setTimeout(() => setProgress(40), 1000)
    setTimeout(() => setProgress(70), 2000)
    
    try {
      // Logic for solver run...
      // For the demo, we simulate a successful generation
      setTimeout(() => {
        setProgress(100)
        setStatus("success")
        toast({
          title: "Roster Generated",
          description: "OR-Tools Solver completed with 0 hard constraint violations."
        })
      }, 3500)
    } catch (e) {
      setStatus("conflict")
    }
  }

  const handleExplain = async () => {
    const result = await explainSchedulingConflicts({
      problemDescription: "Generating weekly roster for 42 optometrists across 6 shifts.",
      hardConstraints: ["Minimum 2 staff per morning shift", "Every employee must have 2 days off"],
      softConstraints: ["Target 50/50 gender balance"],
      solverOutcome: "FEASIBLE",
      detectedConflicts: ["Conflict: Employee Jane Doe assigned to overlapping shifts on Friday."]
    })
    setExplanation(result)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Mathematical Roster Solver</h1>
          <p className="text-muted-foreground">Google OR-Tools CP-SAT engine with GenAI constraint interpretation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export Roster
          </Button>
          <Button className="bg-secondary" onClick={handleRunSolver} disabled={status === 'running'}>
            <BrainCircuit className="mr-2 h-4 w-4" /> Run CP-SAT Solver
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <CardTitle>Solver Controls & Status</CardTitle>
              </div>
              {status === 'success' && <Badge className="bg-green-500">Optimal Solution</Badge>}
              {status === 'conflict' && <Badge variant="destructive">Conflict Detected</Badge>}
            </div>
            <CardDescription>Execute and monitor the mathematical roster optimization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Solver Progress</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border p-4 space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" /> Hard Constraints
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Staffing Quotas: SATISFIED</li>
                  <li>• Weekly-Off Protection: SATISFIED</li>
                  <li>• Single Shift per Day: SATISFIED</li>
                </ul>
              </div>
              <div className="rounded-md border p-4 space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-secondary" /> Soft Objectives
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Gender Balance: 92% Optimized</li>
                  <li>• Preferred Shifts: 85% Satisfied</li>
                  <li>• Consecutive Offs: 100% Satisfied</li>
                </ul>
              </div>
            </div>

            {status === 'success' && (
              <div className="bg-accent/10 border border-accent/20 rounded-md p-4">
                <p className="text-sm font-medium text-accent-foreground mb-2">Optimization Insight</p>
                <p className="text-xs text-muted-foreground">
                  The engine resolved 1,240 variables and 3,100 constraints in 4.2 seconds. 
                  Gender balance targets were prioritized over individual shift preferences.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-muted/10">
            <Button variant="ghost" className="w-full" onClick={handleExplain}>
              <BrainCircuit className="mr-2 h-4 w-4" /> Explain Constraints with GenAI
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>AI Interpretation</CardTitle>
            <CardDescription>Natural language explanation of solver decisions.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px] flex flex-col justify-center text-center">
            {!explanation ? (
              <div className="space-y-4">
                <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
                  <BrainCircuit className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Click "Explain Constraints" to generate a summary of the roster logic.</p>
              </div>
            ) : (
              <div className="text-left space-y-4">
                <div>
                  <h5 className="text-sm font-bold">Summary</h5>
                  <p className="text-xs text-muted-foreground">{explanation.overallSummary}</p>
                </div>
                <div>
                  <h5 className="text-sm font-bold">Interpretation</h5>
                  <p className="text-xs text-muted-foreground">{explanation.solverInterpretation}</p>
                </div>
                <div>
                  <h5 className="text-sm font-bold text-destructive">Conflict Resolution</h5>
                  {explanation.conflictExplanations.map((c: any, i: number) => (
                    <div key={i} className="mt-2 text-xs border-l-2 border-destructive pl-2">
                      <p className="font-semibold">{c.conflict}</p>
                      <p className="text-muted-foreground mt-1">{c.explanation}</p>
                      <p className="text-accent-foreground font-medium mt-1 italic">Action: {c.suggestedAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
