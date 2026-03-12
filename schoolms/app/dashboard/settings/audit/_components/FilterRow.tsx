"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Search, X } from "lucide-react";
import { ACTION_LABELS, ALL_ACTION_TYPES } from "./action-labels";

interface User {
  id: string;
  name: string;
  email: string;
}

interface FilterRowProps {
  fromDate: string;
  toDate: string;
  userId: string;
  actionTypes: string[];
  search: string;
  onFilterChange: (key: "fromDate" | "toDate" | "userId", value: string) => void;
  onActionTypesChange: (types: string[]) => void;
  onSearchChange: (value: string) => void;
  exportUrl: string;
}

export default function FilterRow({
  fromDate,
  toDate,
  userId,
  actionTypes,
  search,
  onFilterChange,
  onActionTypesChange,
  onSearchChange,
  exportUrl,
}: FilterRowProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  const toggleActionType = (type: string) => {
    if (actionTypes.includes(type)) {
      onActionTypesChange(actionTypes.filter((t) => t !== type));
    } else {
      onActionTypesChange([...actionTypes, type]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Date range */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            From
          </label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => onFilterChange("fromDate", e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => onFilterChange("toDate", e.target.value)}
            className="w-40"
          />
        </div>

        {/* User filter */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            User
          </label>
          <Select
            value={userId || "all"}
            onValueChange={(val) =>
              onFilterChange("userId", val === "all" ? "" : val)
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action types dropdown */}
        <div className="space-y-1 relative">
          <label className="text-xs font-medium text-muted-foreground">
            Actions
          </label>
          <Button
            variant="outline"
            className="w-48 justify-between text-sm font-normal"
            onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
          >
            {actionTypes.length === 0
              ? "All actions"
              : `${actionTypes.length} selected`}
          </Button>
          {actionDropdownOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border bg-popover p-2 shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Filter by action type
                </span>
                {actionTypes.length > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => onActionTypesChange([])}
                  >
                    Clear
                  </button>
                )}
              </div>
              {ALL_ACTION_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={actionTypes.includes(type)}
                    onChange={() => toggleActionType(type)}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  {ACTION_LABELS[type] ?? type}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search user or details..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Export */}
        <Button variant="outline" size="sm" asChild>
          <a href={exportUrl} download>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      {/* Active filter badges */}
      {actionTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {actionTypes.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1 text-xs">
              {ACTION_LABELS[type] ?? type}
              <button
                className="ml-0.5 hover:text-foreground"
                onClick={() => toggleActionType(type)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
