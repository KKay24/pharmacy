const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function parsePagination(query = {}) {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

function paginationMeta({ page, limit, total }) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

function paginatedResponse(rows, count, pagination) {
  return { data: rows, pagination: paginationMeta({ ...pagination, total: count }) };
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, paginatedResponse, parsePagination };