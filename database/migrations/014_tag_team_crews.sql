-- Cinis migration 014: Tag Team crew tables
-- Enables family/work crew collaboration with task delegation

-- Create crews table
CREATE TABLE IF NOT EXISTS crews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- 'family' or 'work'
  created_at timestamptz DEFAULT now(),
  CONSTRAINT crews_type_check CHECK (type IN ('family', 'work'))
);

-- Create crew_members table (junction table for many-to-many)
CREATE TABLE IF NOT EXISTS crew_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member', -- 'owner', 'member'
  joined_at timestamptz DEFAULT now(),
  UNIQUE(crew_id, user_id)
);

-- Create crew_tasks table for delegated tasks
CREATE TABLE IF NOT EXISTS crew_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES profiles(id),
  assigned_to uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  due_date date,
  status text DEFAULT 'open', -- 'open', 'claimed', 'done'
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT crew_tasks_status_check CHECK (status IN ('open', 'claimed', 'done'))
);

-- Enable RLS
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_tasks ENABLE ROW LEVEL SECURITY;

-- RLS: users can see crews they're part of
CREATE POLICY crews_select ON crews
  FOR SELECT
  USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM crew_members WHERE crew_id = crews.id AND user_id = auth.uid())
  );

CREATE POLICY crews_insert ON crews
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY crews_update ON crews
  FOR UPDATE
  USING (owner_id = auth.uid());

-- RLS: users can see members of crews they're in
CREATE POLICY crew_members_select ON crew_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crew_members cm2
      WHERE cm2.crew_id = crew_members.crew_id AND cm2.user_id = auth.uid()
    )
  );

CREATE POLICY crew_members_insert ON crew_members
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM crews WHERE id = crew_id AND owner_id = auth.uid())
  );

-- RLS: users can see crew tasks for their crews
CREATE POLICY crew_tasks_select ON crew_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crew_members
      WHERE crew_id = crew_tasks.crew_id AND user_id = auth.uid()
    )
  );

CREATE POLICY crew_tasks_insert ON crew_tasks
  FOR INSERT
  WITH CHECK (
    added_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM crew_members
      WHERE crew_id = crew_tasks.crew_id AND user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crews_owner ON crews(owner_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_crew ON crew_members(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_user ON crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_tasks_crew ON crew_tasks(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_tasks_assigned_to ON crew_tasks(assigned_to);
