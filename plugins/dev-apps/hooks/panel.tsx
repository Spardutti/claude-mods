import type { EngineInterface, RenderChildren, RenderInputOf, RenderSurface } from 'claude-code'

import type { Project, Service, ServiceState } from '../types'
import { LOG_FOLDER } from './commands'
import { isBusy, statusOf } from './running'
import { isAnyDown, isAnyUp } from './containers'
import type { Status } from './running'

export type PaneInput = { [S in RenderSurface]: RenderInputOf<'Pane', S> }[RenderSurface]

export type Actions = { start: () => void; stop: () => void }

export type View = { project: Project; now: number; actions: Actions }

const COLOR: Record<Status, string | undefined> = { running: 'green', starting: 'yellow', stopping: 'yellow', failed: 'red', stopped: undefined }

const SERVICE_COLOR: Record<ServiceState, string | undefined> = {
  running: 'green', starting: 'yellow', unhealthy: 'red', restarting: 'red', crashed: 'red', exited: undefined, stopped: undefined,
}

const serviceLabel = ({ state, exitCode }: Service) => (state === 'crashed' ? `crashed, code ${exitCode}` : state)

function services($: EngineInterface, e: PaneInput, list: Service[] = []) {
  const { Box, Text } = $.ui.resolve(e)
  if (!list.length) return <Text />
  return (
    <Box flexDirection="column">
      <Text bold>Containers</Text>
      {list.map(service => (
        <Text>{service.name} <Text color={SERVICE_COLOR[service.state]} dimColor={!SERVICE_COLOR[service.state]}>{serviceLabel(service)}</Text></Text>
      ))}
    </Box>
  )
}

function controls($: EngineInterface, e: PaneInput, { project, now, actions }: View) {
  const { Box, Button, Text } = $.ui.resolve(e)
  if (!project.launcher) return <Text dimColor>No start command found. Open only.</Text>
  const isUp = project.apps.some(app => project.listening.includes(app.port)) || isAnyUp(project.services)
  const isDown = project.apps.some(app => !project.listening.includes(app.port)) || isAnyDown(project.services)
  const isPressed = isBusy(project, now)
  return (
    <Box>
      {isDown && !isPressed ? <Button key="start" label="Start" onPress={actions.start} /> : <Text />}
      {isUp && isDown && !isPressed ? <Text> </Text> : <Text />}
      {isUp && !isPressed ? <Button key="stop" label="Stop" onPress={actions.stop} /> : <Text />}
    </Box>
  )
}

export function drawApps($: EngineInterface, e: PaneInput, view: View) {
  const { project, now } = view
  const { Box, Link, Text } = $.ui.resolve(e)
  const rows = project.apps.map(app => ({ ...app, status: statusOf(project.listening.includes(app.port), project, now) }))
  const isFailed = rows.some(row => row.status === 'failed')
  return (
    <Box flexDirection="column">
      <Text bold>Apps <Text dimColor>{project.name}</Text></Text>
      {rows.map(({ service, port, status }) => (
        <Box flexDirection="column">
          <Text>{service} <Text color={COLOR[status]} dimColor={status === 'stopped'}>{status}</Text></Text>
          <Text>  <Link href={`http://localhost:${port}`} /></Text>
        </Box>
      ))}
      {isFailed ? <Text color="red">Didn't start in 90s. Log: {LOG_FOLDER}/{project.name}/</Text> : <Text />}
      {isFailed && project.failure ? <Text color="red">{project.failure.slice(0, e.props.bodyColumns)}</Text> : <Text />}
      {services($, e, project.services)}
      {controls($, e, view)}
    </Box>
  )
}

export function splitPane($: EngineInterface, e: PaneInput, { top, apps }: { top: RenderChildren; apps: RenderChildren }) {
  const { Box, Text } = $.ui.resolve(e)
  const rows = e.props.scroll.bodyRows
  const half = Math.floor(rows / 2)
  return (
    <Box flexDirection="column" height={rows}>
      <Box flexDirection="column" height={half} overflow="hidden">{top}</Box>
      <Box flexDirection="column" height={rows - half}>
        <Text dimColor>{'─'.repeat(e.props.bodyColumns)}</Text>
        {apps}
      </Box>
    </Box>
  )
}
