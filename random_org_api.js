import ky from "ky-universal"
import putAfter from "put-after"

async function reqAPI(method, { data, getRandomData, signed}) {
	const shouldSign = signed && method.startsWith("generate") && (data).apiKey
	if (shouldSign) method = putAfter(method, "generate", "Signed")
	const { result, error } = await ky.post("https://api.random.org/json-rpc/2/invoke", {
		json: {
			jsonrpc: "2.0",
			method: method,
			params: data,
			id: 0
		}
	}).json()
	if (error) throw error
	if (getRandomData && !result.random) return undefined
	return getRandomData ? result.random.data : result
}

export async function getSignedInteger({
	api_key,
	min,
	max,
	amount = 1,
	unique = false,
	base = 10
}) {
	return await reqAPI("generateIntegers", {
		data: {
			apiKey: api_key,
			n: amount,
			min,
			max,
			replacement: !unique,
			base,
		},
		getRandomData: false,
		signed: true
	})
}