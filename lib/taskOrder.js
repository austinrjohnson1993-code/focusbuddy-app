export async function saveTaskOrder(supabase, tasks) {
  if (!tasks?.length) return { error: null }

  const results = await Promise.all(
    tasks.map((task, index) =>
      supabase.from('tasks').update({ sort_order: index }).eq('id', task.id || task)
    )
  )

  const errors = results.filter(r => r.error).map(r => r.error)
  if (errors.length > 0) {
    console.error('[taskOrder] saveTaskOrder errors:', errors)
    return { error: errors[0] }
  }

  return { error: null }
}
