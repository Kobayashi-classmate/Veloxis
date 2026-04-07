import { buildCreateOrganizationPayload } from './createPayload'

describe('buildCreateOrganizationPayload', () => {
  test('creates top-level node without organizationId when parent is empty', () => {
    const payload = buildCreateOrganizationPayload({
      values: {
        name: 'Top Node',
        code: 'TOP_NODE',
        node_type: 'team',
        parent_id: undefined,
        status: 'active',
      },
      fullNodeById: new Map(),
    })

    expect(payload.parentId).toBeUndefined()
    expect(payload.parentNodeFound).toBe(true)
    expect(payload.organizationId).toBeUndefined()
    expect(payload.name).toBe('Top Node')
  })

  test('uses selected parent as direct parent and inherits parent organization', () => {
    const parentId = 'org_node_1'
    const payload = buildCreateOrganizationPayload({
      values: {
        name: 'Child Node',
        code: 'CHILD_NODE',
        node_type: 'team',
        parent_id: parentId,
        status: 'active',
      },
      fullNodeById: new Map([
        [
          parentId,
          {
            id: parentId,
            organization_id: 'org_a',
            organization_name: 'Org A',
          },
        ],
      ]),
    })

    expect(payload.parentNodeFound).toBe(true)
    expect(payload.parentId).toBe(parentId)
    expect(payload.organizationId).toBe('org_a')
  })
})
