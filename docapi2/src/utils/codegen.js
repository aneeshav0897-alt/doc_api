export function genCurl(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  let cmd = `curl -X ${method} "${url}"`
  const headers = endpoint._exampleHeaders || {}
  Object.keys(headers).forEach(h => { cmd += ` -H "${h}: ${headers[h]}"` })
  if (['POST','PUT','PATCH'].includes(method) && endpoint.requestExample) {
    try { cmd += ` -d '${JSON.stringify(endpoint.requestExample).replace(/'/g, "\\'")}'` } catch {}
  }
  return cmd
}

export function genFetch(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  const headers = endpoint._exampleHeaders || {}
  const hdrs = JSON.stringify(headers, null, 2)
  const body = (['POST','PUT','PATCH'].includes(method) && endpoint.requestExample) ? `JSON.stringify(${JSON.stringify(endpoint.requestExample, null, 2)})` : 'undefined'

  return `fetch("${url}", {
  method: "${method}",
  headers: ${hdrs},
  body: ${body}
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)`
}

export function genPythonRequests(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = (endpoint.method || 'GET').lower ? (endpoint.method || 'GET').lower() : (endpoint.method || 'GET').toLowerCase()
  const headers = endpoint._exampleHeaders || {}
  const body = (['POST','PUT','PATCH'].includes(endpoint.method) && endpoint.requestExample) ? JSON.stringify(endpoint.requestExample, null, 2) : null

  const headerLines = Object.keys(headers).map(k => `"${k}": "${headers[k]}"`).join(', ')
  return `import requests

url = "${url}"
headers = { ${headerLines} }
resp = requests.${method}(url${body ? ', json=' + body : ''}, headers=headers)
print(resp.status_code)
print(resp.text)`
}

export function genAxios(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  const headers = endpoint._exampleHeaders || {}
  const body = (['POST','PUT','PATCH'].includes(method) && endpoint.requestExample) ? JSON.stringify(endpoint.requestExample, null, 2) : null

  const hdrs = JSON.stringify(headers, null, 2)
  return `import axios from 'axios'

axios({
  method: '${method.toLowerCase()}',
  url: '${url}',
  headers: ${hdrs},
  ${body ? `data: ${body},` : ''}
}).then(r => console.log(r.data)).catch(e => console.error(e))`
}

export function genRuby(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  const headers = endpoint._exampleHeaders || {}
  const body = (['POST','PUT','PATCH'].includes(method) && endpoint.requestExample) ? JSON.stringify(endpoint.requestExample) : null

  const headerLines = Object.keys(headers).map(k => `'${k}' => '${headers[k]}'`).join(", ")
  return `require 'net/http'\nrequire 'json'\n\nuri = URI('${url}')\nhttp = Net::HTTP.new(uri.host, uri.port)\nhttp.use_ssl = true if uri.scheme == 'https'\n\nreq = Net::HTTP::${method.charAt(0) + method.slice(1).toLowerCase()}.new(uri.path)\nreq['Content-Type'] = 'application/json'\nreq.add_field 'Accept', 'application/json'\n\nresponse = http.request(req)\nputs response.body`
}

export function genPHP(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  const headers = endpoint._exampleHeaders || {}
  const body = (['POST','PUT','PATCH'].includes(method) && endpoint.requestExample) ? JSON.stringify(endpoint.requestExample) : null

  const headerLines = Object.keys(headers).map(k => `'${k}: ${headers[k]}'`).join(', ')
  return `<?php\n\\$url = '${url}';\n\\$headers = array(\n  ${headerLines}\n);\n\n\\$ch = curl_init();\ncurl_setopt(\\$ch, CURLOPT_URL, \\$url);\ncurl_setopt(\\$ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt(\\$ch, CURLOPT_CUSTOMREQUEST, '${method}');\ncurl_setopt(\\$ch, CURLOPT_HTTPHEADER, \\$headers);\n${body ? `curl_setopt(\\$ch, CURLOPT_POSTFIELDS, '${body}');` : ''}\n\n\\$response = curl_exec(\\$ch);\ncurl_close(\\$ch);\necho \\$response;\n?>`
}

export function genGo(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  const headers = endpoint._exampleHeaders || {}

  const headerLines = Object.keys(headers).map(k => `\\treq.Header.Set("${k}", "${headers[k]}")`).join("\\n")
  return `package main\n\nimport (\n\\t"fmt"\n\\t"net/http"\n\\t"io"\n)\n\nfunc main() {\n\\tclient := &http.Client{}\n\\treq, _ := http.NewRequest("${method}", "${url}", nil)\n\\t${headerLines}\n\\t\n\\tresp, _ := client.Do(req)\n\\tdefer resp.Body.Close()\n\\t\n\\tbody, _ := io.ReadAll(resp.Body)\n\\tfmt.Println(string(body))\n}`
}

export function genJava(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  const headers = endpoint._exampleHeaders || {}

  const headerLines = Object.keys(headers).map(k => `\\t\\tconn.setRequestProperty("${k}", "${headers[k]}");`).join("\\n")
  return `import java.net.HttpURLConnection;\nimport java.net.URL;\n\npublic class ApiRequest {\n\\tpublic static void main(String[] args) throws Exception {\n\\t\\tURL url = new URL("${url}");\n\\t\\tHttpURLConnection conn = (HttpURLConnection) url.openConnection();\n\\t\\tconn.setRequestMethod("${method}");\n\\t\\t${headerLines}\n\\t\\t\n\\t\\tint responseCode = conn.getResponseCode();\n\\t\\tSystem.out.println("Response Code: " + responseCode);\n\\t}\n}`
}

export function genCSharp(baseUrl, endpoint) {
  const url = (baseUrl ? baseUrl.replace(/\/$/, '') : '') + endpoint.path
  const method = endpoint.method || 'GET'
  const headers = endpoint._exampleHeaders || {}
  const body = (['POST','PUT','PATCH'].includes(method) && endpoint.requestExample) ? JSON.stringify(endpoint.requestExample, null, 2) : null

  const headerLines = Object.keys(headers).map(k => `client.DefaultRequestHeaders.Add("${k}", "${headers[k]}");`).join("\\n    ")
  const methodName = method.charAt(0) + method.slice(1).toLowerCase()

  return `using System;\nusing System.Net.Http;\nusing System.Net.Http.Headers;\nusing System.Threading.Tasks;\n\nclass Program {\n  static async Task Main() {\n    using var client = new HttpClient();\n    ${headerLines ? headerLines + "\n    " : ""}var request = new HttpRequestMessage(HttpMethod.${methodName}, "${url}");\n    ${body ? `request.Content = new StringContent(${JSON.stringify(body)}, System.Text.Encoding.UTF8, \"application/json\");` : ""}\n    var response = await client.SendAsync(request);\n    var text = await response.Content.ReadAsStringAsync();\n    Console.WriteLine(text);\n  }\n}`
}
