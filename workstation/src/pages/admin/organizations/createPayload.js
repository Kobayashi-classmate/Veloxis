export const buildCreateOrganizationPayload = ({ values, fullNodeById }) => {
  const parentId = values?.parent_id || undefined
  const parentNode = parentId ? fullNodeById?.get?.(parentId) : null
  const resolvedOrganizationId = parentNode?.organization_id || parentNode?.organization_name

  return {
    parentId,
    parentNodeFound: !parentId || Boolean(parentNode),
    organizationId: resolvedOrganizationId || undefined,
    name: values?.name,
    code: values?.code,
    nodeType: values?.node_type,
    status: values?.status,
  }
}
