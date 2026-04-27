"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

interface GradeDistributionHeatmapProps {
  heatmapData: {
    subject: string;
    bands: {
      label: string;
      range: [number, number];
      count: number;
      percentage: number;
    }[];
  }[];
}

export default function GradeDistributionHeatmap({
  heatmapData,
}: GradeDistributionHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !svg || !tooltip || heatmapData.length === 0) return;

    const selection = d3.select(svg);
    selection.selectAll("*").remove();

    const subjects = heatmapData.map((d) => d.subject);
    const bandLabels = heatmapData[0]?.bands.map((b) => b.label) || [];

    const margin = { top: 50, right: 20, bottom: 10, left: 100 };
    const width = container.clientWidth - margin.left - margin.right;
    const cellHeight = 32;
    const height = subjects.length * cellHeight;

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

    const xScale = d3
      .scaleBand<string>()
      .domain(bandLabels)
      .range([0, width])
      .padding(0.05);

    const yScale = d3
      .scaleBand<string>()
      .domain(subjects)
      .range([0, height])
      .padding(0.05);

    const maxPercentage = d3.max(
      heatmapData.flatMap((d) => d.bands.map((b) => b.percentage))
    ) || 1;

    const colorScale = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([0, maxPercentage]);

    // Flatten data for cells
    const cells = heatmapData.flatMap((row) =>
      row.bands.map((band) => ({
        subject: row.subject,
        label: band.label,
        count: band.count,
        percentage: band.percentage,
      }))
    );

    // Draw cells
    g.selectAll("rect")
      .data(cells)
      .enter()
      .append("rect")
      .attr("x", (d) => xScale(d.label) || 0)
      .attr("y", (d) => yScale(d.subject) || 0)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("rx", 2)
      .attr("fill", (d) =>
        d.count === 0 ? "#f3f4f6" : colorScale(d.percentage)
      )
      .style("cursor", "default")
      .on("mouseover", (_event: MouseEvent, d) => {
        const rect = (_event.target as SVGRectElement).getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        tooltip.style.opacity = "1";
        tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - containerRect.top - 8}px`;
        tooltip.innerHTML = `
          <div class="font-medium">${d.subject}</div>
          <div>Band: ${d.label}</div>
          <div>Count: ${d.count}</div>
          <div>Percentage: ${d.percentage.toFixed(1)}%</div>
        `;
      })
      .on("mouseout", () => {
        tooltip.style.opacity = "0";
      });

    // Cell text
    g.selectAll("text.cell-label")
      .data(cells)
      .enter()
      .append("text")
      .attr("class", "cell-label")
      .attr("x", (d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
      .attr("y", (d) => (yScale(d.subject) || 0) + yScale.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 11)
      .attr("fill", (d) => (d.percentage > maxPercentage * 0.6 ? "#fff" : "#374151"))
      .text((d) => (d.count > 0 ? `${d.percentage.toFixed(0)}%` : ""));

    // Y axis (subjects)
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .select(".domain")
      .remove();

    // X axis (band labels) at top
    g.append("g")
      .attr("transform", `translate(0, -4)`)
      .call(d3.axisTop(xScale).tickSize(0))
      .select(".domain")
      .remove();

    g.selectAll(".tick text").attr("font-size", 11);
  }, [heatmapData]);

  useEffect(() => {
    render();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-white px-3 py-2 text-xs shadow-sm transition-opacity"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
