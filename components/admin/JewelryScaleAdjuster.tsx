"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { Loader2, Sparkles, Info } from "lucide-react";
import {
  analyzeJewelryScale,
  applyJewelryScale,
  type ScaleAnalysisResult,
} from "@/lib/admin/jewelry-actions";
import { Button } from "@/components/shadcn/ui/button";
import { Input } from "@/components/shadcn/ui/input";
import { Label } from "@/components/shadcn/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/ui/card";
import { Alert, AlertDescription } from "@/components/shadcn/ui/alert";

interface JewelryScaleAdjusterProps {
  jewelryId: string;
  currentScale: number;
  hasGlb: boolean;
  gauge?: number | null;
  size?: number | null;
}

export function JewelryScaleAdjuster({
  jewelryId,
  currentScale,
  hasGlb,
  gauge,
  size,
}: JewelryScaleAdjusterProps) {
  const [analysis, setAnalysis] = useState<ScaleAnalysisResult | null>(null);
  const [isAnalyzing, startAnalysis] = useTransition();
  const [manualScale, setManualScale] = useState(currentScale.toString());
  const [applyState, applyAction] = useActionState(applyJewelryScale, undefined);

  // Don't auto-run analysis - let user trigger it manually
  // This avoids slow page loads

  const runAnalysis = () => {
    startAnalysis(async () => {
      const result = await analyzeJewelryScale(jewelryId);
      setAnalysis(result);
      if (result.ok && result.suggestedScale) {
        setManualScale(result.suggestedScale.toFixed(4));
      }
    });
  };

  if (!hasGlb) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Загрузите 3D-модель, чтобы настроить масштаб.
        </AlertDescription>
      </Alert>
    );
  }

  const hasMetadata = gauge != null || size != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent" />
          Масштаб модели
        </CardTitle>
        <CardDescription>
          Текущий масштаб: <strong>{currentScale.toFixed(4)}</strong>
          {hasMetadata && (
            <>
              {" • "}
              {gauge && `Толщина: ${gauge}мм`}
              {gauge && size && " • "}
              {size && `Размер: ${size}мм`}
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata hint */}
        {!hasMetadata && (
          <Alert className="border-accent/40 bg-accent/5">
            <Info className="h-4 w-4 text-accent" />
            <AlertDescription className="text-sm text-ink">
              💡 <strong>Совет:</strong> Укажите <strong>толщину (gauge)</strong>{" "}
              или <strong>размер (size)</strong> в форме выше для точного расчёта
              масштаба. Без этих данных ИИ даст только приблизительную оценку.
            </AlertDescription>
          </Alert>
        )}

        {/* AI Analysis Section */}
        {!analysis && !isAnalyzing && (
          <Button
            onClick={runAnalysis}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Анализировать модель с ИИ
          </Button>
        )}

        {isAnalyzing && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-mute">
            <Loader2 className="h-4 w-4 animate-spin" />
            Анализ геометрии модели...
          </div>
        )}

        {analysis && (
          <>
            {analysis.ok ? (
              <div className="space-y-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="flex-1 space-y-2 text-sm">
                    <p className="text-ink">{analysis.reasoning}</p>

                    {analysis.suggestedScale && (
                      <div className="space-y-1">
                        <p className="font-medium text-accent">
                          Рекомендуемый масштаб:{" "}
                          <code className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-xs">
                            {analysis.suggestedScale.toFixed(4)}
                          </code>
                        </p>
                        {analysis.confidence != null && (
                          <p className="text-xs text-mute">
                            Уверенность:{" "}
                            {Math.round(analysis.confidence * 100)}%
                          </p>
                        )}
                      </div>
                    )}

                    {analysis.boundingBox && (
                      <details className="text-xs text-mute">
                        <summary className="cursor-pointer hover:text-ink">
                          Размеры модели в GLB
                        </summary>
                        <div className="mt-1 space-y-0.5 pl-4">
                          <p>
                            X: {(analysis.boundingBox.size.x * 1000).toFixed(2)}
                            мм
                          </p>
                          <p>
                            Y: {(analysis.boundingBox.size.y * 1000).toFixed(2)}
                            мм
                          </p>
                          <p>
                            Z: {(analysis.boundingBox.size.z * 1000).toFixed(2)}
                            мм
                          </p>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>{analysis.error}</AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Manual Scale Input */}
        <form action={applyAction} className="space-y-3">
          <input type="hidden" name="id" value={jewelryId} />

          <div className="space-y-2">
            <Label htmlFor="scale" className="text-sm">
              Установить масштаб вручную
            </Label>
            <div className="flex gap-2">
              <Input
                id="scale"
                name="scale"
                type="number"
                step="0.0001"
                min="0.0001"
                max="100"
                value={manualScale}
                onChange={(e) => setManualScale(e.target.value)}
                className="font-mono"
              />
              <Button type="submit" size="sm" className="shrink-0">
                Применить
              </Button>
            </div>
            <p className="text-xs text-mute">
              Обычные значения: 0.01–0.05 для Tripo, 1.0 для параметрических
              моделей
            </p>
          </div>

          {applyState?.ok === false && (
            <Alert variant="destructive">
              <AlertDescription>{applyState.error}</AlertDescription>
            </Alert>
          )}
          {applyState?.ok === true && (
            <Alert className="border-accent/40 bg-accent/5">
              <AlertDescription className="text-accent">
                {applyState.message}
              </AlertDescription>
            </Alert>
          )}
        </form>

        {analysis?.ok && analysis.suggestedScale && (
          <Button
            onClick={runAnalysis}
            variant="ghost"
            size="sm"
            className="w-full text-xs"
          >
            Пересчитать
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
