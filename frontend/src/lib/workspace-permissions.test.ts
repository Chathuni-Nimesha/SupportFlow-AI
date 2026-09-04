import { describe, expect, it } from "vitest"

import {
  makeAdminUser,
  makeAgentUser,
  makeAuthUser,
  makeWorkspaceSummary,
  sampleUser,
} from "@/test/fixtures"
import {
  canManageKnowledge,
  canManageTeam,
  canManageWorkspace,
  currentWorkspace,
  currentWorkspaceId,
  currentWorkspaceRole,
} from "@/lib/workspace-permissions"

describe("workspace permissions", () => {
  it("reads the current workspace from default_workspace_id", () => {
    const user = makeAuthUser({
      default_workspace_id: "workspace-2",
      workspaces: [
        makeWorkspaceSummary({ id: "workspace-1", name: "First", role: "AGENT" }),
        makeWorkspaceSummary({ id: "workspace-2", name: "Second", role: "ADMIN" }),
      ],
    })

    expect(currentWorkspaceId(user)).toBe("workspace-2")
    expect(currentWorkspace(user)).toEqual(
      makeWorkspaceSummary({ id: "workspace-2", name: "Second", role: "ADMIN" }),
    )
    expect(currentWorkspaceRole(user)).toBe("ADMIN")
  })

  it("falls back to the first available workspace when default is missing", () => {
    const user = makeAuthUser({
      default_workspace_id: null,
      workspaces: [
        makeWorkspaceSummary({ id: "workspace-9", name: "Fallback", role: "OWNER" }),
      ],
    })

    expect(currentWorkspace(user)?.id).toBe("workspace-9")
    expect(currentWorkspaceRole(user)).toBe("OWNER")
  })

  it("gives OWNER workspace, team, and knowledge management", () => {
    expect(currentWorkspaceRole(sampleUser)).toBe("OWNER")
    expect(canManageWorkspace(sampleUser)).toBe(true)
    expect(canManageTeam(sampleUser)).toBe(true)
    expect(canManageKnowledge(sampleUser)).toBe(true)
  })

  it("gives ADMIN the same management permissions as OWNER", () => {
    const admin = makeAdminUser()
    expect(currentWorkspaceRole(admin)).toBe("ADMIN")
    expect(canManageWorkspace(admin)).toBe(true)
    expect(canManageTeam(admin)).toBe(true)
    expect(canManageKnowledge(admin)).toBe(true)
  })

  it("hides management controls for AGENT", () => {
    const agent = makeAgentUser()
    expect(currentWorkspaceRole(agent)).toBe("AGENT")
    expect(canManageWorkspace(agent)).toBe(false)
    expect(canManageTeam(agent)).toBe(false)
    expect(canManageKnowledge(agent)).toBe(false)
  })

  it("keeps management controls when role is unknown", () => {
    expect(canManageTeam(null)).toBe(true)
    expect(canManageKnowledge(undefined)).toBe(true)
    expect(canManageWorkspace(makeAuthUser({ workspaces: [] }))).toBe(true)
  })
})
