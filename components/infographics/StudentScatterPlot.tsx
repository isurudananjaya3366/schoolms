"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { THRESHOLD_COLORS } from "@/lib/chartPalette";
import type { ScatterEntry } from "@/app/dashboard/analytics/AnalyticsContainer";

interface StudentScatterPlotProps {
  scatterData: ScatterEntry[];
}

function getDotColor(wCount: number): string {
  if (wCount === 0) return THRESHOLD_COLORS.pass;
  if (wCount <= 2) return THRESHOLD_COLORS.atRisk;
  return THRESHOLD_COLORS.fail;
}

export default function StudentScatterPlot({
  scatterData,
}: StudentScatterPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !svg || !tooltip || scatterData.length === 0) return;

    const selection = d3.select(svg);
    selection.selectAll("*").remove();

    const sorted = [...scatterData].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const margin = { top: 20, right: 20, bottom: 40, left: 120 };
    const width = container.clientWidth - margin.left - margin.right;
    const bandHeight = 24;
    const height = sorted.length * bandHeight;

    svg.setAttribute(
      "width",
      String(width + margin.left + margin.right)
    );
    svg.setAttribute(
      "height",
      String(height + margin.top + margin.bottom)
    );

    const g = selection
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const maxMarks = d3.max(sorted, (d) => d.totalMarks) || 100;

    const xScale = d3
      .scaleLinear()
      .domain([0, maxMarks])
      .range([0, width])
      .nice();

    const yScale = d3
      .scaleBand<string>()
      .domain(sorted.map((d) => d.name))
      .range([0, height])
      .padding(0.3);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("font-size", 10);

    // X axis label
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 34)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#6b7280")
      .text("Total Marks");

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .select(".domain")
      .remove();

    g.selectAll(".tick text").attr("font-size", 10);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(xScale.ticks())
      .enter()
      .append("line")
      .attr("x1", (d) => xScale(d))
      .attr("x2", (d) => xScale(d))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "3 3");

    // Circles
    g.selectAll("circle")
      .data(sorted)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.totalMarks))
      .attr("cy", (d) => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
      .attr("r", 6)
      .attr("fill", (d) => getDotColor(d.wCount))
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .on("click", (_event: MouseEvent, d) => {
        window.location.href = d.profileUrl;
      })
      .on("mouseover", (_event: MouseEvent, d) => {
        const circle = _event.target as SVGCircleElement;
        const rect = circle.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        tooltip.style.opacity = "1";
        tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - containerRect.top - 8}px`;
        tooltip.innerHTML = `
          <div class="font-medium">${d.name}</div>
          <div>Total: ${d.totalMarks}</div>
          <div>W Count: ${d.wCount}</div>
          <div>Section: ${d.section}</div>
        `;
      })
      .on("mouseout", () => {
        tooltip.style.opacity = "0";
      });
  }, [scatterData]);

  useEffect(() => {
    render();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div ref={containerRef} className="relative w-full max-h-[500px] overflow-y-auto">
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-white px-3 py-2 text-xs shadow-sm transition-opacity"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
