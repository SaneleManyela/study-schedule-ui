import { useNavigate } from "react-router";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "./ui/menubar";

interface AppMenuBarProps {
  onRefresh: () => void;
}

export function AppMenuBar({ onRefresh }: AppMenuBarProps) {
  const navigate = useNavigate();

  return (
    <Menubar className="border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onRefresh} className="cursor-pointer">
            Refresh
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger
          className="cursor-pointer"
          onClick={() => navigate("/")}
        >
          Truth Engine
        </MenubarTrigger>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger
          className="cursor-pointer"
          onClick={() => navigate("/workbench")}
        >
          Workbench
        </MenubarTrigger>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger
          className="cursor-pointer"
          onClick={() => navigate("/ask")}
        >
          Ask
        </MenubarTrigger>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger
          className="cursor-pointer"
          onClick={() => navigate("/admin")}
        >
          Admin
        </MenubarTrigger>
      </MenubarMenu>
    </Menubar>
  );
}
