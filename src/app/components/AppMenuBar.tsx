import { useNavigate } from "react-router";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
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
        <MenubarTrigger className="cursor-pointer">Systems</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => navigate("/")} className="cursor-pointer">
            Systems Home
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => navigate("/research/workbench")} className="cursor-pointer">
            Research Pipeline System
          </MenubarItem>
          <MenubarItem onClick={() => navigate("/assignment/workflow")} className="cursor-pointer">
            Assignment Workflow System
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer">Research</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => navigate("/research/workbench")} className="cursor-pointer">
            Workbench
          </MenubarItem>
          <MenubarItem onClick={() => navigate("/research/ask")} className="cursor-pointer">
            Ask
          </MenubarItem>
          <MenubarItem onClick={() => navigate("/research/admin")} className="cursor-pointer">
            Admin
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer">Assignment</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => navigate("/assignment/workflow")} className="cursor-pointer">
            Workflow Studio
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
