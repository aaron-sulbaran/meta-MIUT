import { Card } from "@/components/ui/card";
import { MapPinIcon } from "@/components/ui/icons";

export function MapPlaceholder() {
  return (
    <Card className="mx-3 mt-3 text-center">
      <MapPinIcon className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-2 text-[20px] font-bold">Campus map</h1>
      <p className="mt-1 text-[15px] text-muted">
        Placeholder. The map lane owns this screen: events within about a mile, pinned on a free-tile map.
      </p>
    </Card>
  );
}
