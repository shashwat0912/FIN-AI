{{- define "finance-ai.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "finance-ai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "finance-ai.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "finance-ai.labels" -}}
helm.sh/chart: {{ include "finance-ai.chart" . }}
{{ include "finance-ai.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "finance-ai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "finance-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "finance-ai.backendFullname" -}}
{{- printf "%s-backend" (include "finance-ai.fullname" . | trunc 54 | trimSuffix "-") }}
{{- end }}

{{- define "finance-ai.frontendFullname" -}}
{{- printf "%s-frontend" (include "finance-ai.fullname" . | trunc 54 | trimSuffix "-") }}
{{- end }}

{{- define "finance-ai.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "finance-ai.fullname" .) .Values.serviceAccount.name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- default "default" .Values.serviceAccount.name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "finance-ai.image" -}}
{{- if .digest }}
{{- printf "%s@%s" .repository .digest }}
{{- else }}
{{- printf "%s:%s" .repository .tag }}
{{- end }}
{{- end }}
