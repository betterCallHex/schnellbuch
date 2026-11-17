import { LayoutGridIcon, ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Layout, setViewPrefs, useViewPrefs } from "@/lib/view-prefs";
import type { SortOrder } from "@/lib/views";

// Wide screens get their own View button; on phones the same options sit in
// the toolbar's ⋯ menu (ViewOptions).
export function ViewMenu() {
  const { layout } = useViewPrefs();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="View"
            className="hidden rounded-full sm:inline-flex"
            size="icon"
            title="View"
            variant="outline"
          />
        }
      >
        {layout === "grid" ? <LayoutGridIcon /> : <ListIcon />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <ViewOptions />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ViewOptions() {
  const { layout, sort } = useViewPrefs();
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Show as</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => setViewPrefs({ layout: value as Layout })}
          value={layout}
        >
          <DropdownMenuRadioItem value="grid">
            <LayoutGridIcon />
            Icons
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list">
            <ListIcon />
            List
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Sort bookmarks by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => setViewPrefs({ sort: value as SortOrder })}
          value={sort}
        >
          <DropdownMenuRadioItem value="saved">
            Date saved
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </>
  );
}
