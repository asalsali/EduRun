import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 mb-4">
            <span className="text-white font-bold text-lg leading-none">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">EduRun</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Passive assessment for Conrad School BET courses
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/chat"
            className="group bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="text-2xl mb-3">🎓</div>
            <h2 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
              I&apos;m a Student
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              Start a tutoring session
            </p>
          </Link>

          <Link
            href="/instructor"
            className="group bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="text-2xl mb-3">📊</div>
            <h2 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
              I&apos;m an Instructor
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              View session dashboard
            </p>
          </Link>
        </div>

      </div>
    </main>
  )
}
