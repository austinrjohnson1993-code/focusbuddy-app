import { supabaseAdmin } from './supabase'

/**
 * Create a new task for a user
 * @param {Object} params
 * @param {string} params.userId - Task owner user ID
 * @param {string} params.title - Task title
 * @param {string} params.scheduledFor - ISO date string for scheduled_for
 * @param {string|null} params.dueTime - ISO timestamp for due_time
 * @param {number|null} params.estimatedMinutes - Estimated duration in minutes
 * @param {string|null} params.notes - Task notes
 * @param {string} params.taskType - Task type (regular, chore, bill, etc) — default: 'regular'
 * @param {boolean} params.starred - Whether task is starred
 * @returns {Promise<Object>} Newly created task row
 */
export async function createTask({
  userId,
  title,
  scheduledFor,
  dueTime = null,
  estimatedMinutes = null,
  notes = null,
  taskType = 'regular',
  starred = false,
}) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not initialized')
  if (!userId || !title) throw new Error('userId and title are required')

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: userId,
      title,
      scheduled_for: scheduledFor,
      due_time: dueTime,
      estimated_minutes: estimatedMinutes,
      notes,
      task_type: taskType,
      starred,
      completed: false,
      archived: false,
      recurrence: 'none',
      rollover_count: 0,
      priority_score: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Mark a task as complete
 * @param {string} taskId - Task ID
 * @param {string} userId - Task owner user ID (for ownership verification)
 * @returns {Promise<Object>} Updated task row
 */
export async function completeTask(taskId, userId) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not initialized')
  if (!taskId || !userId) throw new Error('taskId and userId are required')

  // Verify ownership
  const { data: task, error: fetchError } = await supabaseAdmin
    .from('tasks')
    .select('user_id')
    .eq('id', taskId)
    .single()

  if (fetchError || !task || task.user_id !== userId) {
    throw new Error('Unauthorized: task does not belong to user')
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Reschedule a task to a new date
 * @param {string} taskId - Task ID
 * @param {string} userId - Task owner user ID (for ownership verification)
 * @param {string} newDate - New scheduled_for date (ISO string)
 * @returns {Promise<Object>} Updated task row
 */
export async function rescheduleTask(taskId, userId, newDate) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not initialized')
  if (!taskId || !userId || !newDate) throw new Error('taskId, userId, and newDate are required')

  // Verify ownership
  const { data: task, error: fetchError } = await supabaseAdmin
    .from('tasks')
    .select('user_id, rollover_count')
    .eq('id', taskId)
    .single()

  if (fetchError || !task || task.user_id !== userId) {
    throw new Error('Unauthorized: task does not belong to user')
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({
      scheduled_for: newDate,
      rollover_count: (task.rollover_count || 0) + 1,
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Star or unstar a task
 * @param {string} taskId - Task ID
 * @param {string} userId - Task owner user ID (for ownership verification)
 * @param {boolean} starred - Star status
 * @returns {Promise<Object>} Updated task row
 */
export async function starTask(taskId, userId, starred) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not initialized')
  if (!taskId || !userId) throw new Error('taskId and userId are required')

  // Verify ownership
  const { data: task, error: fetchError } = await supabaseAdmin
    .from('tasks')
    .select('user_id')
    .eq('id', taskId)
    .single()

  if (fetchError || !task || task.user_id !== userId) {
    throw new Error('Unauthorized: task does not belong to user')
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ starred })
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw error
  return data
}
