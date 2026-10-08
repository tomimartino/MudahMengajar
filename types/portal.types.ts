export interface PortalLink {
  id: string;
  user_id: string;
  student_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export type PortalTables = {
  portal_links: {
    Row: { [K in keyof PortalLink]: PortalLink[K] };
    Insert: Partial<PortalLink> & Pick<PortalLink, "user_id" | "student_id" | "token_hash">;
    Update: Partial<PortalLink>;
    Relationships: [];
  };
};
