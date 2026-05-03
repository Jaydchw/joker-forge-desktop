import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

export function GithubStarDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleShowDialog = () => setIsOpen(true);
    window.addEventListener("show-github-star-dialog", handleShowDialog);
    return () => window.removeEventListener("show-github-star-dialog", handleShowDialog);
  }, []);

  useEffect(() => {
    const hasDismissed = localStorage.getItem("hasDismissedGithubStar");
    if (hasDismissed === "true") return;

    // Timer is 5 minutes (300000 ms)
    const timer = setTimeout(() => {
      const alreadyDismissed = localStorage.getItem("hasDismissedGithubStar");
      if (alreadyDismissed !== "true") {
        setIsOpen(true);
      }
    }, 300000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("hasDismissedGithubStar", "true");
    setIsOpen(false);
  };

  const handleStar = async () => {
    try {
      await openUrl("https://github.com/Jaydchw/joker-forge-desktop");
      localStorage.setItem("hasDismissedGithubStar", "true");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to open URL", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            Star Joker Forge
          </DialogTitle>
          <DialogDescription>
            Enjoying Joker Forge? It would mean a lot if you could star the project on GitHub! It helps other people find the app.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-end">
          <Button variant="ghost" onClick={handleDismiss} className="cursor-pointer">
            Don't show again
          </Button>
          <Button onClick={handleStar} className="gap-2 cursor-pointer">
            <Star className="w-4 h-4" />
            Star on GitHub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
